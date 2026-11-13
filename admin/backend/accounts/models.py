from django.contrib.auth.models import AbstractUser, Group, Permission
from django.db import models

class AdminUser(AbstractUser):
    """
    管理者用ユーザーモデル
    """
    email = models.EmailField(
        verbose_name='メールアドレス',
        unique=True,
        null=False,
        blank=False
    )

    # 逆参照名の衝突を防ぐための定義
    groups = models.ManyToManyField(
        Group,
        verbose_name='groups',
        blank=True,
        related_name='admin_user_set',
        related_query_name='admin_user',
    )
    user_permissions = models.ManyToManyField(
        Permission,
        verbose_name='user permissions',
        blank=True,
        related_name='admin_user_permissions_set',
        related_query_name='admin_user_permission',
    )

    class Meta:
        db_table = 'ADMIN'


class MobileUser(AbstractUser):
    """
    利用者（スマホアプリ）用ユーザーモデル
    """
    email = models.EmailField(
        verbose_name='メールアドレス',
        unique=True,
        null=False,
        blank=False
    )

    # 逆参照名の衝突を防ぐための定義
    groups = models.ManyToManyField(
        Group,
        verbose_name='groups',
        blank=True,
        related_name='mobile_user_set',
        related_query_name='mobile_user',
    )
    user_permissions = models.ManyToManyField(
        Permission,
        verbose_name='user permissions',
        blank=True,
        related_name='mobile_user_permissions_set',
        related_query_name='mobile_user_permission',
    )

    class Meta:
        db_table = 'USER'


class MobileSession(models.Model):
    """モバイル専用の試作用セッション。トークンの原文は保存しない。"""
    user = models.ForeignKey(MobileUser, on_delete=models.CASCADE)
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()


class PendingMobileRegistration(models.Model):
    """メール確認待ちの登録。パスワードと確認コードの原文は保存しない。"""
    email = models.EmailField(unique=True)
    password_hash = models.CharField(max_length=128, blank=True)
    code_hash = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True)
    failed_attempts = models.PositiveIntegerField(default=0)
    used_at = models.DateTimeField(null=True, blank=True)
