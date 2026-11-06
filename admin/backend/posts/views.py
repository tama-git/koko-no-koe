from io import BytesIO

from PIL import Image, ImageOps
from django.db import transaction
from django.db.models import Q
from django.http import FileResponse
from rest_framework import generics, status
from rest_framework.exceptions import APIException, NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response

from .authentication import MobileBearerAuthentication
from .models import HiddenPost, Post, PostReport
from .serializers import PostDetailSerializer, PostReportSerializer, PostSerializer


class PostAccess:
    authentication_classes = [MobileBearerAuthentication]
    permission_classes = [IsAuthenticated]
    renderer_classes = [JSONRenderer]
    serializer_class = PostSerializer

    def get_queryset(self):
        return Post.objects.order_by('-created_at', '-id')

    def public_filter(self):
        # 距離判定を追加するまでは公開設定だけで絞り込む。
        return Q(is_public=True)

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
        serializer.save(user_id=self.request.user)


class PublicPostListAPIView(PostAccess, generics.ListAPIView):
    def get_queryset(self):
        return super().get_queryset().filter(self.public_filter())


class ReadablePostAccess(PostAccess):
    def get_queryset(self):
        return super().get_queryset().filter(Q(user_id=self.request.user) | self.public_filter())


class PostPhotoDeletionError(APIException):
    status_code = 503
    default_detail = '写真を削除できませんでした。時間をおいてもう一度お試しください。'


class PostDetailAPIView(ReadablePostAccess, generics.RetrieveDestroyAPIView):
    serializer_class = PostDetailSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.method == 'DELETE':
            return queryset.filter(user_id=self.request.user)
        return queryset

    def perform_destroy(self, instance):
        image = instance.image
        with transaction.atomic():
            deleted, _ = instance.delete()
            if not deleted:
                raise NotFound('投稿が見つかりませんでした。')
            # 古いデータで同じ画像を参照する投稿があれば、その画像は残す。
            if image and not Post.objects.filter(image=image.name).exists():
                try:
                    image.delete(save=False)
                except OSError as error:
                    # ファイルを消せなければ投稿レコードを戻し、再試行できるようにする。
                    raise PostPhotoDeletionError() from error



    
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
            # 他の会員へは撮影時の位置・機種などのメタデータを渡さない。
            with post.image.open('rb') as source, Image.open(source) as photo:
                with ImageOps.exif_transpose(photo).convert('RGB') as preview:
                    preview.info.clear()
                    output = BytesIO()
                    preview.save(output, format='JPEG', quality=90)
            output.seek(0)
            return FileResponse(output, content_type='image/jpeg')
        except (OSError, ValueError, Image.DecompressionBombError):
            raise NotFound('写真を取得できません。')
