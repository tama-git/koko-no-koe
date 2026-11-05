from django.urls import path
from .views import PostListCreateAPIView, PublicPostListAPIView, PostDetailAPIView, PostImageAPIView

urlpatterns = [
    # モバイルアプリからの通信を受け付けるエンドポイント
    path('', PostListCreateAPIView.as_view(), name='post-list-create'),
    path('public/', PublicPostListAPIView.as_view(), name='post-public-list'),
    path('<int:pk>/', PostDetailAPIView.as_view(), name='post-detail'),
    path('<int:pk>/image/', PostImageAPIView.as_view(), name='post-image'),
]
