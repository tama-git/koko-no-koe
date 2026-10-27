"""仮画面を各自のPCで確認するための開発設定。本番公開には使わない。"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
ADMIN_FRONTEND = BASE_DIR.parent / "frontend"

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "local-preview-only-not-for-deployment")
DEBUG = True
ALLOWED_HOSTS = ["127.0.0.1", "localhost", "[::1]"]

INSTALLED_APPS = ["django.contrib.staticfiles", "preview"]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
ROOT_URLCONF = "config.urls"
TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [ADMIN_FRONTEND / "templates"],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": ["django.template.context_processors.request"]},
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
