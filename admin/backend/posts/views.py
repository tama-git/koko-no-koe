import logging
import uuid

from django.db import DatabaseError, transaction
from django.db.models import Q
from django.http import FileResponse, Http404
from rest_framework import generics, status
from rest_framework.exceptions import APIException, NotFound, PermissionDenied, ValidationError
from rest_framework.parsers import JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response

from .authentication import MobileBearerAuthentication
from .images import (
    NORMALIZED_PHOTO_DIRECTORY, create_post_thumbnail, delete_unreferenced_post_photo,
    post_photo_preview, post_thumbnail_name,
)
from .models import HiddenPost, Post, PostReport
from .nearby import viewer_coordinates
from .read_access import readable_posts, visible_public_posts
from .serializers import PostDetailSerializer, PostReportSerializer, PostSerializer


logger = logging.getLogger(__name__)


class PostAccess:
    authentication_classes = [MobileBearerAuthentication]
    permission_classes = [IsAuthenticated]
    renderer_classes = [JSONRenderer]
    serializer_class = PostSerializer

    def get_queryset(self):
        return Post.objects.order_by('-created_at', '-id')

    def public_filter(self):
        return Q(is_public=True, admin_hidden_at__isnull=True)

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'private, no-store'
        return response


class PostListCreateAPIView(PostAccess, generics.ListCreateAPIView):
    """
    投稿の一覧取得（GET）と新規作成（POST）を行うAPIビュー
    """
    def get_queryset(self):
        return super().get_queryset().filter(user_id=self.request.user)

    def perform_create(self, serializer):
        # 投稿者は端末からのIDではなく、ログイン済み会員から決める。
        photo = serializer.validated_data.get('image')
        if photo is None:
            serializer.save(user_id=self.request.user)
            return

        storage = Post._meta.get_field('image').storage
        attempted_names = []
        try:
            while True:
                name = f'{NORMALIZED_PHOTO_DIRECTORY}{uuid.uuid4().hex}.jpg'
                thumbnail_name = post_thumbnail_name(name)
                if not storage.exists(name) and not storage.exists(thumbnail_name):
                    break
            attempted_names.append(name)
            attempted_names[-1] = storage.save(name, photo)
            if attempted_names[-1] != name:
                raise OSError('Post photo filename collision')

            with storage.open(name, 'rb') as source, create_post_thumbnail(source) as thumbnail:
                attempted_names.append(thumbnail_name)
                attempted_names[-1] = storage.save(thumbnail_name, thumbnail)
                if attempted_names[-1] != thumbnail_name:
                    raise OSError('Post thumbnail filename collision')

            with transaction.atomic():
                serializer.save(user_id=self.request.user, image=name)
        except Exception as error:
            # 保存途中に失敗した場合も、各ファイルを個別に後片付けする。
            for attempted_name in reversed(attempted_names):
                try:
                    storage.delete(attempted_name)
                except OSError:
                    logger.error('Could not clean up a failed post photo upload.')
            if isinstance(error, (OSError, DatabaseError)):
                raise PostPhotoSaveError() from error
            raise


class PostPhotoSaveError(APIException):
    status_code = 503
    default_detail = '写真を保存できませんでした。時間をおいてもう一度お試しください。'


class PublicPostListAPIView(PostAccess, generics.ListAPIView):
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        viewer = request.user
        try:
            coordinates = viewer_coordinates(request)
        except ValidationError:
            # 現在地が使えなくても地図は表示できる。本文は返さない。
            coordinates = None

        visible = visible_public_posts(queryset, viewer).filter(
            latitude__range=(-90, 90), longitude__range=(-180, 180),
        )
        pins = [
            {'id': post_id, 'latitude': float(latitude), 'longitude': float(longitude)}
            for post_id, latitude, longitude in visible.values_list('pk', 'latitude', 'longitude')
        ]
        posts = readable_posts(queryset, viewer, coordinates, include_owned=False)
        return Response({'pins': pins, 'posts': self.get_serializer(posts, many=True).data})


class ReadablePostAccess(PostAccess):
    def get_queryset(self):
        queryset = super().get_queryset().filter(pk=self.kwargs['pk'])
        viewer = self.request.user
        if queryset.filter(user_id=viewer).exists():
            return readable_posts(queryset, viewer)

        try:
            coordinates = viewer_coordinates(self.request, required=True)
        except ValidationError:
            # 閲覧対象外の投稿には、位置情報の有無にかかわらず同じ404を返す。
            if visible_public_posts(queryset, viewer).exists():
                raise
            return queryset.none()
        return readable_posts(queryset, viewer, coordinates)


class PostPhotoDeletionError(APIException):
    status_code = 503
    default_detail = '写真を削除できませんでした。時間をおいてもう一度お試しください。'


class PostDetailAPIView(ReadablePostAccess, generics.RetrieveDestroyAPIView):
    serializer_class = PostDetailSerializer

    def get_queryset(self):
        if self.request.method == 'DELETE':
            return PostAccess.get_queryset(self).filter(user_id=self.request.user)
        return super().get_queryset()

    def perform_destroy(self, instance):
        image_name = instance.image.name
        with transaction.atomic():
            deleted, _ = instance.delete()
            if not deleted:
                raise NotFound('投稿が見つかりませんでした。')
            try:
                delete_unreferenced_post_photo(image_name)
            except OSError as error:
                # ファイルを消せなければ投稿レコードを戻し、再試行できるようにする。
                raise PostPhotoDeletionError() from error


class PostVisibilityAPIView(PostAccess, generics.GenericAPIView):
    parser_classes = [JSONParser]

    def patch(self, request, pk):
        data = request.data
        if not isinstance(data, dict) or set(data) != {'is_published'} or not isinstance(data['is_published'], bool):
            raise ValidationError({'is_published': '公開または本人のみ公開を選択してください。'})

        owned_post = Post.objects.filter(pk=pk, user_id=request.user)
        # 管理者非表示の確認と公開設定の保存を、同じ更新クエリで実行する。
        if not owned_post.filter(admin_hidden_at__isnull=True).update(is_public=data['is_published']):
            if not owned_post.exists():
                raise NotFound('投稿が見つかりませんでした。')
            raise PermissionDenied('管理者により非表示のため、公開設定を変更できません。')
        return Response({'is_published': data['is_published']})



    
class AlreadyReported(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = 'この投稿はすでに通報済みです。'


class PostReportAPIView(PostAccess, generics.GenericAPIView):
    serializer_class = PostReportSerializer

    def post(self, request, pk):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target = self.get_queryset().filter(self.public_filter(), pk=pk).exclude(user_id=request.user)
        with transaction.atomic():
            # 通報の保存と状態更新をまとめ、重複時は状態変更も取り消す。
            if not target.update(report_status=Post.ReportStatus.PENDING):
                raise NotFound('通報できる投稿が見つかりませんでした。')
            _, created = PostReport.objects.get_or_create(
                post_id=pk, reporter=request.user, defaults=serializer.validated_data,
            )
            if not created:
                raise AlreadyReported()
        return Response({'status': 'received'}, status=status.HTTP_201_CREATED)


class AlreadyHidden(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = 'この投稿はすでに非表示にしています。'


class PostHideAPIView(PostAccess, generics.GenericAPIView):
    def post(self, request, pk):
        target = self.get_queryset().filter(self.public_filter(), pk=pk).exclude(user_id=request.user)
        if not target.exists():
            raise NotFound('非表示にできる投稿が見つかりませんでした。')
        _, created = HiddenPost.objects.get_or_create(user_id=request.user, post_id_id=pk)
        if not created:
            raise AlreadyHidden()
        return Response({'status': 'hidden'}, status=status.HTTP_201_CREATED)


class PostImageAPIView(ReadablePostAccess, generics.GenericAPIView):
    def get(self, request, *args, **kwargs):
        post = self.get_object()
        if not post.image:
            raise NotFound('写真がありません。')
        try:
            if post.user_id_id == request.user.pk:
                return FileResponse(post.image.open('rb'), as_attachment=False)
            return post_photo_preview(post.image)
        except (OSError, ValueError, Http404) as error:
            raise NotFound('写真を取得できません。') from error


class PostThumbnailAPIView(ReadablePostAccess, generics.GenericAPIView):
    def get(self, request, *args, **kwargs):
        image = self.get_object().image
        name = post_thumbnail_name(image.name)
        if not name:
            raise NotFound('サムネイルがありません。')
        try:
            return FileResponse(image.storage.open(name, 'rb'), content_type='image/jpeg')
        except FileNotFoundError as error:
            raise NotFound('サムネイルがありません。') from error
