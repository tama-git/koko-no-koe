from django.urls import path
from . import views

app_name = 'mobile'

urlpatterns = [
    path('login/', views.mobile_login_view, name='login'),
    path('register/', views.mobile_register_view, name='register'),
    path('index/', views.mobile_index_view, name='index'),
    path('logout/', views.mobile_logout_view, name='logout'),
]