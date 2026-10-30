from django.urls import path
from . import views

app_name = 'admin_side'

urlpatterns = [
    path('', views.admin_dashboard_view, name='dashboard'),
    path('login/', views.admin_login_view, name='login'),
    path('dashboard/', views.admin_dashboard_view, name='dashboard'),
    path('logout/', views.admin_logout_view, name='logout'),
]