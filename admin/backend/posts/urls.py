from django.urls import path
from .views import (
    PostListCreateAPIView, PublicPostListAPIView, PostDetailAPIView, PostImageAPIView,
    PostReportAPIView, PostHideAPIView, PostVisibilityAPIView,
)
from likes.views import PostReactionAPIView

urlpatterns = [
    # モバイルアプリからの通信を受け付けるエンドポイント
    path('', PostListCreateAPIView.as_view(), name='post-list-create'),
    path('public/', PublicPostListAPIView.as_view(), name='post-public-list'),
    path('<int:pk>/', PostDetailAPIView.as_view(), name='post-detail'),
    path('<int:pk>/visibility/', PostVisibilityAPIView.as_view(), name='post-visibility'),
    path('<int:pk>/image/', PostImageAPIView.as_view(), name='post-image'),
    path('<int:pk>/reports/', PostReportAPIView.as_view(), name='post-report'),
    path('<int:pk>/hidden/', PostHideAPIView.as_view(), name='post-hide'),
    # reactions は likes アプリで管理するが、URLは posts と同じプレフィックス配下に置く
    path('<int:pk>/reactions/', PostReactionAPIView.as_view(), name='post-reaction'),
]
