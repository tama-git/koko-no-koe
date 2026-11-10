from django.urls import path
from .views import ContactCreateView

urlpatterns = [
    # お問い合わせ送信APIのエンドポイント
    path('contacts/', ContactCreateView.as_view(), name='contact-create'),
]