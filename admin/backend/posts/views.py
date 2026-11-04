from rest_framework import generics
from .models import Post
from .serializers import PostSerializer

class PostListCreateAPIView(generics.ListCreateAPIView):
    """
    投稿の一覧取得（GET）と新規作成（POST）を行うAPIビュー
    """
    queryset = Post.objects.all().order_by('-created_at')
    serializer_class = PostSerializer