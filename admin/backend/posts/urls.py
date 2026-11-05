from django.urls import path
from .views import PostListCreateAPIView, PostDetailAPIView, PostImageAPIView

urlpatterns = [
    # モバイルアプリからの通信を受け付けるエンドポイント
    path('', PostListCreateAPIView.as_view(), name='post-list-create'),
    path('<int:pk>/', PostDetailAPIView.as_view(), name='post-detail'),
    path('<int:pk>/image/', PostImageAPIView.as_view(), name='post-image'),
]
