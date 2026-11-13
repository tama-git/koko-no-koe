from django.urls import path
from .unavailable import mobile_html_unavailable
from . import api_views

app_name = 'mobile'

urlpatterns = [
    path('login/', mobile_html_unavailable, name='login'),
    path('register/', mobile_html_unavailable, name='register'),
    path('index/', mobile_html_unavailable, name='index'),
    path('logout/', mobile_html_unavailable, name='logout'),
    path('request-register-otp/', api_views.request_register_otp, name='request_register_otp'),
    path('verify-register-otp/', api_views.verify_register_otp, name='verify_register_otp'),
]
