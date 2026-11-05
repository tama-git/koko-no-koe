from rest_framework import generics
from .models import Post
from .serializers import PostSerializer
from django.http import FileResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.renderers import JSONRenderer
from rest_framework.exceptions import NotFound
from .authentication import MobileBearerAuthentication


class OwnPostAccess:
    authentication_classes = [MobileBearerAuthentication]
    permission_classes = [IsAuthenticated]
    renderer_classes = [JSONRenderer]
    serializer_class = PostSerializer

    def get_queryset(self):
        # 地域・距離の公開ルールが未接続の間は、本人の投稿だけを確認できる。
        return Post.objects.filter(user_id=self.request.user).order_by('-created_at', '-id')

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'private, no-store'
        return response


class PostListCreateAPIView(OwnPostAccess, generics.ListCreateAPIView):
    """
    投稿の一覧取得（GET）と新規作成（POST）を行うAPIビュー
    """
    def perform_create(self, serializer):
        # 投稿者は端末からのIDではなく、ログイン済み会員から決める。
        serializer.save(user_id=self.request.user)


class PostDetailAPIView(OwnPostAccess, generics.RetrieveAPIView):
    pass


class PostImageAPIView(OwnPostAccess, generics.GenericAPIView):
    def get(self, request, *args, **kwargs):
        post = self.get_object()
        if not post.image:
            raise NotFound('写真がありません。')
        try:
            return FileResponse(post.image.open('rb'), as_attachment=False)
        except OSError:
            raise NotFound('写真を取得できません。')
