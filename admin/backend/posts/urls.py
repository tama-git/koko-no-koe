from django.urls import path
from .views import PostListCreateAPIView

urlpatterns = [
    # モバイルアプリからの通信を受け付けるエンドポイント
    path('', PostListCreateAPIView.as_view(), name='post-list-create'),
]