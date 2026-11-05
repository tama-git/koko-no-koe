from django.db import models

class Post(models.Model):
    """
    投稿テーブル
    """
    # 会員IDとの紐付け
    user_id = models.ForeignKey('accounts.MobileUser', on_delete=models.CASCADE)

    # メッセージ
    message = models.TextField(
        verbose_name='メッセージ',
        null=False,
        blank=False
    )

    # 写真
    image = models.ImageField(
        verbose_name='写真',
        null=True,
        blank=True
    )

    # 緯度
    latitude = models.DecimalField(
        verbose_name='緯度',
        null=True,
        blank=True,
        max_digits=10,
        decimal_places=7
    )

    # 経度
    longitude = models.DecimalField(
        verbose_name='経度',
        null=True,
        blank=True,
        max_digits=10,
        decimal_places=7
    )

    # 公開ステータス
    is_public = models.BooleanField(
        verbose_name='公開ステータス',
        null=True,
        blank=True
    )

    # 投稿日時
    created_at = models.DateTimeField(
        verbose_name='投稿日時',
        auto_now_add=True
    )

    class Meta:
        db_table = 'POST'