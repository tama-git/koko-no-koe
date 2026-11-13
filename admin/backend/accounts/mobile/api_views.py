"""管理者のDjangoログインとは独立した、開発用モバイル認証API。"""
import hashlib
import json
import re
import secrets
import uuid
from datetime import timedelta

from django.contrib.auth.hashers import make_password
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.db.models import F
from django.http import JsonResponse
from django.utils import timezone
from django.utils.crypto import salted_hmac
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from ..models import MobileSession, MobileUser, PendingMobileRegistration


CODE_LIFETIME = timedelta(minutes=10)
RESEND_INTERVAL = timedelta(seconds=60)
MAX_CODE_ATTEMPTS = 5


def error(message, status):
    """エラーレスポンスを統一フォーマット { "error": "..." } で返す。"""
    return JsonResponse({'error': message}, status=status)


def json_fields(request, *fields):
    """指定した文字列の項目を JSON から順に取り出す。"""
    try:
        if request.content_type != 'application/json' or len(request.body) > 8192:
            return None
        data = json.loads(request.body)
    except (ValueError, UnicodeDecodeError):
        return None
    if not isinstance(data, dict) or any(not isinstance(data.get(field), str) for field in fields):
        return None
    return tuple(data[field] for field in fields)


def credentials(request):
    values = json_fields(request, 'email', 'password')
    if values is None:
        return None
    email, password = values
    return email.strip().lower(), password


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


def registration_id(pending):
    return salted_hmac(
        'mobile-registration-id', pending.password_hash, algorithm='sha256',
    ).hexdigest()


def registration_code_hash(pending, code):
    return salted_hmac(
        'mobile-registration-code', f'{pending.password_hash}:{code}', algorithm='sha256',
    ).hexdigest()


def pending_registration(email, supplied_id):
    pending = PendingMobileRegistration.objects.filter(email=email, used_at__isnull=True).first()
    if pending and secrets.compare_digest(registration_id(pending), supplied_id):
        return pending
    return None


def send_registration_code(pending, password_hash):
    now = timezone.now()
    registrations = PendingMobileRegistration.objects
    if pending and pending.created_at > now - RESEND_INTERVAL:
        return error('認証コードの送信から60秒経ってからお試しください。', 429)

    # 初回送信・入力のやり直しでは登録IDも変え、再送時だけ同じ登録IDを使う。
    registration = PendingMobileRegistration(email=pending.email, password_hash=password_hash)
    while True:
        code = f'{secrets.randbelow(1_000_000):06d}'
        if registration_code_hash(pending, code) != pending.code_hash:
            break
    code_hash = registration_code_hash(registration, code)
    updated = registrations.filter(
        pk=pending.pk, created_at__lte=now - RESEND_INTERVAL,
        password_hash=pending.password_hash, code_hash=pending.code_hash,
    ).update(
        password_hash=password_hash, code_hash=code_hash, created_at=now,
        expires_at=now + CODE_LIFETIME, failed_attempts=0, used_at=None,
    )
    if not updated:
        return error('登録状態が変わりました。少し待ってからお試しください。', 429)
    return deliver_registration_code(registration, code, code_hash)


def deliver_registration_code(registration, code, code_hash):
    try:
        sent = send_mail(
            '【ここの声】会員登録の認証コード',
            f'認証コードは {code} です。有効期限は10分です。\n'
            '会員登録の画面で入力してください。このコードは他の人に教えないでください。\n'
            '登録に心当たりがない場合は、このメールを破棄してください。',
            None, [registration.email],
        )
    except (OSError, ValueError):
        sent = 0
    if not sent:
        PendingMobileRegistration.objects.filter(
            email=registration.email, code_hash=code_hash, used_at__isnull=True,
        ).update(expires_at=timezone.now())
        return error('認証メールを送信できませんでした。時間をおいてお試しください。', 503)
    return JsonResponse({
        'message': '認証コードを送信しました。',
        'registration_id': registration_id(registration),
    })


@csrf_exempt  # Cookie による認証は使用しない JSON API。
@require_POST
def start_registration(request):
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

    password_hash = make_password(password)
    registration = PendingMobileRegistration(email=email, password_hash=password_hash)
    code = f'{secrets.randbelow(1_000_000):06d}'
    code_hash = registration_code_hash(registration, code)
    pending, created = PendingMobileRegistration.objects.get_or_create(
        email=email,
        defaults={'password_hash': password_hash, 'code_hash': code_hash,
                  'expires_at': timezone.now() + CODE_LIFETIME},
    )
    if created:
        return deliver_registration_code(pending, code, code_hash)
    return send_registration_code(pending, password_hash)


def registration_request(request, *fields):
    values = json_fields(request, 'email', 'registration_id', *fields)
    if values is None:
        return None
    email, supplied_id, *extra = values
    email = email.strip().lower()
    if not valid_email(email) or not re.fullmatch(r'[0-9a-f]{64}', supplied_id):
        return None
    return email, pending_registration(email, supplied_id), extra


@csrf_exempt
@require_POST
def resend_registration(request):
    values = registration_request(request)
    if values is None:
        return error('送信内容を確認してください。', 400)
    email, pending, _ = values
    if MobileUser.objects.filter(email__iexact=email).exists():
        return error('このメールアドレスは登録済みです。', 409)
    if pending is None:
        return error('入力に戻り、認証コードを送信してください。', 400)
    return send_registration_code(pending, pending.password_hash)


@csrf_exempt
@require_POST
def register(request):
    """メール認証に成功したときだけ会員を作成する。"""
    values = registration_request(request, 'code')
    if values is None:
        return error('送信内容を確認してください。', 400)
    email, pending, (code,) = values
    if not re.fullmatch(r'[0-9]{6}', code):
        return error('認証コードを半角数字6桁で入力してください。', 400)
    if pending is None or pending.expires_at <= timezone.now():
        return error('認証コードが無効か有効期限が切れています。再送してください。', 400)
    if pending.failed_attempts >= MAX_CODE_ATTEMPTS:
        return error('認証コードの入力上限に達しました。再送してください。', 429)

    # SQLite でも、再送・誤入力・登録完了と競合したときは条件付き更新で確認する。
    active = PendingMobileRegistration.objects.filter(
        pk=pending.pk, code_hash=pending.code_hash, used_at__isnull=True,
        expires_at__gt=timezone.now(), failed_attempts__lt=MAX_CODE_ATTEMPTS,
    )
    if not secrets.compare_digest(registration_code_hash(pending, code), pending.code_hash):
        if not active.update(failed_attempts=F('failed_attempts') + 1):
            return error('認証コードを確認できません。再送してください。', 400)
        if PendingMobileRegistration.objects.filter(pk=pending.pk, code_hash=pending.code_hash,
                                                   failed_attempts__gte=MAX_CODE_ATTEMPTS).exists():
            return error('認証コードの入力上限に達しました。再送してください。', 429)
        return error('認証コードが正しくありません。', 400)

    try:
        with transaction.atomic():
            if not active.update(used_at=timezone.now(), password_hash='', code_hash=''):
                return error('認証コードを確認できません。再送してください。', 400)
            if MobileUser.objects.filter(email__iexact=email).exists():
                return error('このメールアドレスは登録済みです。', 409)
            MobileUser.objects.create(email=email, username=uuid.uuid4().hex, password=pending.password_hash)
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
def delete_account(request):
    """退会。パスワードを確認してからユーザーと関連データをすべて削除する。
    Post.user_id が CASCADE のため、投稿・セッション・リアクション・通報・非表示レコードも連鎖削除される。"""
    user = _session_user(request)
    if not user:
        return error('ログイン状態を確認できません。', 401)
    try:
        if request.content_type != 'application/json' or len(request.body) > 4096:
            return error('送信内容を確認してください。', 400)
        data = json.loads(request.body)
        if not isinstance(data, dict) or not isinstance(data.get('password'), str):
            return error('送信内容を確認してください。', 400)
    except (ValueError, UnicodeDecodeError):
        return error('送信内容を確認してください。', 400)
    # パスワードが一致しない場合は退会させない
    if not user.check_password(data['password']):
        return error('パスワードが正しくありません。', 401)
    with transaction.atomic():
        user.delete()  # CASCADE で投稿・セッション・リアクション・通報・非表示レコードも削除される
    return JsonResponse({'message': '退会しました。'})


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
