from django.apps import AppConfig


class LikesConfig(AppConfig):
    """投稿へのリアクション機能を管理するアプリ設定。"""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'likes'
