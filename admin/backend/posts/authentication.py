import hashlib

from django.utils import timezone
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from accounts.models import MobileSession


class MobileBearerAuthentication(BaseAuthentication):
    """既存のモバイルログインで発行したトークンだけを受け付ける。"""
    def authenticate(self, request):
        parts = get_authorization_header(request).split()
        if not parts:
            return None
        if len(parts) != 2 or parts[0].lower() != b'bearer':
            raise AuthenticationFailed('ログイン状態を確認できません。')
        digest = hashlib.sha256(parts[1]).hexdigest()
        session = MobileSession.objects.select_related('user').filter(
            token_hash=digest, expires_at__gt=timezone.now(), user__is_active=True,
        ).first()
        if not session:
            raise AuthenticationFailed('ログインの有効期限が切れています。再ログインしてください。')
        return session.user, session

    def authenticate_header(self, request):
        return 'Bearer'
