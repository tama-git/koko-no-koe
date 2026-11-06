from django.db import models
from pathlib import Path
import uuid


def post_image_path(instance, filename):
    return 'posts/' + uuid.uuid4().hex + Path(filename).suffix.lower()

class Post(models.Model):
    """
    投稿テーブル
    """
    class ReportStatus(models.TextChoices):
        PENDING = 'pending', '要確認'
        REVIEWED = 'reviewed', '閲覧済み'
        RESOLVED = 'resolved', '対応済み'

    # 会員IDとの紐付け
    user_id = models.ForeignKey('accounts.MobileUser', on_delete=models.CASCADE)

    # メッセージ
    message = models.TextField(
        verbose_name='メッセージ',
        null=False,
        blank=True
    )

    # 写真
    image = models.ImageField(
        upload_to=post_image_path,
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

    report_status = models.CharField(max_length=12, choices=ReportStatus.choices, null=True, blank=True)

    # 投稿日時
    created_at = models.DateTimeField(
        verbose_name='投稿日時',
        auto_now_add=True
    )

    class Meta:
        db_table = 'POST'


class HiddenPost(models.Model):
    """
    非表示テーブル
    """
    # 会員IDとの紐付け
    user_id = models.ForeignKey('accounts.MobileUser', on_delete=models.CASCADE, related_name='hidden_posts') 
    # 投稿IDとの紐付け
    post_id = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='hidden_posts')

    class Meta:
        db_table = 'HIDDEN'

class PostReport(models.Model):
    class Category(models.TextChoices):
        SPAM = 'spam', '迷惑行為・スパム'
        HARASSMENT = 'harassment', '誹謗中傷・嫌がらせ'
        INAPPROPRIATE = 'inappropriate', '不適切な内容'
        PRIVACY = 'privacy', '個人情報の公開'
        OTHER = 'other', 'その他'

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='reports')
    reporter = models.ForeignKey('accounts.MobileUser', on_delete=models.CASCADE, related_name='post_reports')
    category = models.CharField(max_length=16, choices=Category.choices)
    details = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['post', 'reporter'], name='unique_post_report_per_member'),
        ]
