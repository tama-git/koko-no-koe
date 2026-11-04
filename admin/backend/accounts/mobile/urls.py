from django.urls import path
from .unavailable import mobile_html_unavailable

app_name = 'mobile'

urlpatterns = [
    path('login/', mobile_html_unavailable, name='login'),
    path('register/', mobile_html_unavailable, name='register'),
    path('index/', mobile_html_unavailable, name='index'),
    path('logout/', mobile_html_unavailable, name='logout'),
]
