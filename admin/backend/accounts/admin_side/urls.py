from django.urls import path
from . import views

app_name = 'admin_side'

urlpatterns = [
    path('login/', views.admin_login_view, name='login'),
    path('dashboard/', views.admin_dashboard_view, name='dashboard'),
    path('dashboard/posts/<int:pk>/', views.admin_post_detail_view, name='post-detail'),
    path('dashboard/posts/<int:pk>/review/', views.admin_post_review_view, name='post-review'),
    path('dashboard/posts/<int:pk>/photo/', views.admin_post_photo_view, name='post-photo'),
    path('logout/', views.admin_logout_view, name='logout'),
]
