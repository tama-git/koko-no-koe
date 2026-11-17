"""実データのDBを開かずに回帰テストするための設定。"""
from .settings import *  # noqa: F403

GEOAPIFY_API_KEY = ''

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
        'TEST': {'NAME': ':memory:'},
    },
}
