"""独自管理画面専用。auth.User / MobileUser の認証とは混ぜない。"""
from django.contrib.auth.backends import BaseBackend

from .models import AdminUser


def is_admin_account(user):
    return isinstance(user, AdminUser) and user.is_active and user.is_staff


class AdminEmailBackend(BaseBackend):
    def authenticate(self, request, admin_email=None, password=None):
        # 専用の引数名にし、通常の username 認証ではこの処理を使わせない。
        if not isinstance(admin_email, str) or not isinstance(password, str):
            return None
        matches = list(AdminUser.objects.filter(email__iexact=admin_email.strip())[:2])
        if len(matches) != 1:
            # 未登録と登録済みの場合で、ハッシュ計算時間が極端に違わないようにする。
            AdminUser().set_password(password)
            return None
        user = matches[0]
        if user.check_password(password) and is_admin_account(user):
            return user
        return None

    def get_user(self, user_id):
        # DjangoはセッションにIDとバックエンド名を保存する。このモデルだけから復元する。
        try:
            user = AdminUser.objects.get(pk=user_id)
        except AdminUser.DoesNotExist:
            return None
        return user if is_admin_account(user) else None
