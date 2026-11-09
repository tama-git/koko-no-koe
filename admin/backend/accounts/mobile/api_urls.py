# モバイルアプリ向け API のルーティング。
# すべて /api/mobile/<path>/ の形式でアクセスする（config/urls.py で prefix を設定済み）。

from django.urls import path
from . import api_views

urlpatterns = [
    path('register/', api_views.register),          # 新規登録
    path('login/', api_views.login),                # ログイン → トークン取得
    path('logout/', api_views.logout),              # ログアウト → セッション削除
    path('change-password/', api_views.change_password),  # パスワード変更
]
