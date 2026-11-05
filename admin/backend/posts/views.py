from io import BytesIO

from PIL import Image, ImageOps
from django.db.models import Q
from django.http import FileResponse
from rest_framework import generics
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.renderers import JSONRenderer

from .authentication import MobileBearerAuthentication
from .models import Post
from .serializers import PostSerializer


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


class PostDetailAPIView(ReadablePostAccess, generics.RetrieveAPIView):
    pass


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
