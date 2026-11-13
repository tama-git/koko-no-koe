# モバイルアプリ向け API のルーティング。
# すべて /api/mobile/<path>/ の形式でアクセスする（config/urls.py で prefix を設定済み）。

from django.urls import path
from . import api_views

urlpatterns = [
    path('register/', api_views.register),          # 新規登録
    path('login/', api_views.login),                # ログイン → トークン取得
    path('logout/', api_views.logout),              # ログアウト → セッション削除
    path('change-password/', api_views.change_password),  # パスワード変更
    path('delete-account/', api_views.delete_account),    # 退会
    path('request-register-otp/', api_views.request_register_otp),  # 新規登録の2段階目（OTPコード送信）
    path('verify-register-otp/', api_views.verify_register_otp),      # 新規登録の2段階目（OTPコード確認）
]
