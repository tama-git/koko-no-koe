"""仮画面を各自のPCで確認するための開発設定。本番公開には使わない。"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
ADMIN_FRONTEND = BASE_DIR.parent / "frontend"

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "local-preview-only-not-for-deployment")
DEBUG = True
ALLOWED_HOSTS = ["127.0.0.1", "localhost", "[::1]"]
# ローカル開発でiPhoneから接続する場合だけ、PCのIPアドレスを追加する。
ALLOWED_HOSTS += [host.strip() for host in os.environ.get("DJANGO_EXTRA_ALLOWED_HOSTS", "").split(",") if host.strip()]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "preview",
    "accounts",
    "posts",
    "likes",
    "utility",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]
ROOT_URLCONF = "config.urls"
TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [ADMIN_FRONTEND / "templates"],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}
LANGUAGE_CODE = "ja"
TIME_ZONE = "Asia/Tokyo"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
STATICFILES_DIRS = [ADMIN_FRONTEND / "static"]
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
MEDIA_ROOT = BASE_DIR / 'media'
MEDIA_URL = '/media/'

# 標準管理画面の auth.User と、独自管理画面の AdminUser は別の認証対象。
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "accounts.backends.AdminEmailBackend",
]
LOGIN_URL = "admin_side:login"

# 会員登録用の送信設定。認証情報はDjangoを起動する環境に設定する。
EMAIL_HOST = os.environ.get("DJANGO_EMAIL_HOST", "localhost")
EMAIL_PORT = int(os.environ.get("DJANGO_EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("DJANGO_EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("DJANGO_EMAIL_HOST_PASSWORD", "")
EMAIL_USE_SSL = os.environ.get("DJANGO_EMAIL_SECURITY") == "ssl"
EMAIL_USE_TLS = os.environ.get("DJANGO_EMAIL_SECURITY", "tls") == "tls"
EMAIL_TIMEOUT = 10
DEFAULT_FROM_EMAIL = os.environ.get("DJANGO_DEFAULT_FROM_EMAIL", EMAIL_HOST_USER or "webmaster@localhost")
