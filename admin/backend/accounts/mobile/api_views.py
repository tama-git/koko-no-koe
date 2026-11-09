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
    """エラーレスポンスを統一フォーマット { "error": "..." } で返す。"""
    return JsonResponse({'error': message}, status=status)


def credentials(request):
    """リクエストボディから email と password を取り出す。
    形式が不正な場合は None を返す。"""
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
    """Django の validate_email + 長さチェック。"""
    try:
        validate_email(email)
        return len(email) <= 254
    except ValidationError:
        return False


def valid_password(password):
    """8文字以上、英大文字・英小文字・数字・記号のうち3種類以上。
    フロント側の useChangePassword.ts / auth/validation.ts と同じ条件にする。"""
    kinds = (r'[A-Z]', r'[a-z]', r'[0-9]', r'[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]')
    return 8 <= len(password) <= 1024 and sum(bool(re.search(kind, password)) for kind in kinds) >= 3


@csrf_exempt  # Cookie による認証は使用しない JSON API。
@require_POST
def register(request):
    """新規ユーザー登録。成功時は 201 を返す。"""
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
    """ログイン。成功時はトークンを返す。トークンの原文は DB に保存しない（ハッシュのみ保存）。"""
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
    """ログアウト。セッションレコードを削除する。"""
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


def _session_user(request):
    """Authorization ヘッダーの Bearer トークンを検証して MobileUser を返す。
    トークンが無効・期限切れ・ユーザーが無効の場合は None を返す。
    logout 以外の認証が必要なビューで共通して使う。"""
    authorization = request.headers.get('Authorization', '')
    if not authorization.startswith('Bearer '):
        return None
    digest = hashlib.sha256(authorization[7:].encode()).hexdigest()
    session = MobileSession.objects.filter(
        token_hash=digest,
        expires_at__gt=timezone.now(),
        user__is_active=True,
    ).select_related('user').first()
    return session.user if session else None


@csrf_exempt
@require_POST
def change_password(request):
    """パスワード変更。現在のパスワードを確認してから新しいパスワードに更新する。
    変更後もセッションはそのまま維持する（再ログイン不要）。"""
    user = _session_user(request)
    if not user:
        return error('ログイン状態を確認できません。', 401)
    try:
        if request.content_type != 'application/json' or len(request.body) > 4096:
            return error('送信内容を確認してください。', 400)
        data = json.loads(request.body)
        if not isinstance(data, dict) or not isinstance(data.get('current_password'), str) or not isinstance(data.get('new_password'), str):
            return error('送信内容を確認してください。', 400)
    except (ValueError, UnicodeDecodeError):
        return error('送信内容を確認してください。', 400)
    # 現在のパスワードが正しいか確認
    if not user.check_password(data['current_password']):
        return error('現在のパスワードが正しくありません。', 401)
    if not valid_password(data['new_password']):
        return error('パスワードは8文字以上で、英大文字・英小文字・数字・記号のうち3種類以上を使ってください。', 400)
    user.set_password(data['new_password'])
    user.save(update_fields=['password'])  # password フィールドだけ更新
    return JsonResponse({'message': 'パスワードを変更しました。'})
