"""管理者のDjangoログインとは独立した、開発用モバイル認証API。"""
import hashlib
import json
import re
import secrets
import uuid
from datetime import timedelta

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from ..models import MobileSession, MobileUser


def error(message, status):
    return JsonResponse({'error': message}, status=status)


def credentials(request):
    try:
        if request.content_type != 'application/json' or len(request.body) > 4096:
            return None
        data = json.loads(request.body)
        if not isinstance(data, dict) or not isinstance(data.get('email'), str) or not isinstance(data.get('password'), str):
            return None
        return data['email'].strip().lower(), data['password']
    except (ValueError, UnicodeDecodeError):
        return None


def valid_email(email):
    try:
        validate_email(email)
        return len(email) <= 254
    except ValidationError:
        return False


def valid_password(password):
    kinds = (r'[A-Z]', r'[a-z]', r'[0-9]', r'[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]')
    return 8 <= len(password) <= 1024 and sum(bool(re.search(kind, password)) for kind in kinds) >= 3


@csrf_exempt  # Cookieによる認証は使用しないJSON API。
@require_POST
def register(request):
    values = credentials(request)
    if values is None:
        return error('送信内容を確認してください。', 400)
    email, password = values
    if not valid_email(email):
        return error('メールアドレスの形式を確認してください。', 400)
    if not valid_password(password):
        return error('パスワードは8文字以上で、英大文字・英小文字・数字・記号のうち3種類以上を使ってください。', 400)
    if MobileUser.objects.filter(email__iexact=email).exists():
        return error('このメールアドレスは登録済みです。', 409)
    try:
        with transaction.atomic():
            user = MobileUser(email=email, username=uuid.uuid4().hex)
            user.set_password(password)
            user.save()
    except IntegrityError:
        return error('このメールアドレスは登録済みです。', 409)
    return JsonResponse({'message': '登録が完了しました。ログインしてください。'}, status=201)


@csrf_exempt
@require_POST
def login(request):
    values = credentials(request)
    if values is None:
        return error('送信内容を確認してください。', 400)
    email, password = values
    # 過去のデータに大文字小文字違いの重複がある場合は、曖昧な認証をしない。
    matches = list(MobileUser.objects.filter(email__iexact=email)[:2])
    user = matches[0] if len(matches) == 1 else None
    if not user or not user.is_active or not user.check_password(password):
        return error('メールアドレスまたはパスワードが正しくありません。', 401)
    token = secrets.token_urlsafe(32)
    MobileSession.objects.create(user=user, token_hash=hashlib.sha256(token.encode()).hexdigest(), expires_at=timezone.now() + timedelta(hours=12))
    return JsonResponse({'token': token})


@csrf_exempt
@require_POST
def logout(request):
    authorization = request.headers.get('Authorization', '')
    if not authorization.startswith('Bearer '):
        return error('ログイン状態を確認できません。', 401)
    token = authorization[7:]
    digest = hashlib.sha256(token.encode()).hexdigest()
    session = MobileSession.objects.filter(token_hash=digest, expires_at__gt=timezone.now(), user__is_active=True).first()
    if not session:
        return error('ログイン状態を確認できません。', 401)
    session.delete()
    return JsonResponse({'message': 'ログアウトしました。'})
