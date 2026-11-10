from django.urls import path
from .views import ContactCreateView, ContactAdminListView, ContactDetailView


urlpatterns = [
    # ユーザー用：お問い合わせ送信
    path('contacts/', ContactCreateView.as_view(), name='contact-create'),
    
    # 管理者用：お問い合わせ一覧取得
    path('admin/contacts/', ContactAdminListView.as_view(), name='contact-admin-list'),

    #　管理者用：お問い合わせ詳細
    # ※もしAPIプレフィックスの構成が違う場合は既存のパスに合わせてください
    path('admin/contacts/<int:pk>/', ContactDetailView.as_view(), name='contact-admin-detail'),
]