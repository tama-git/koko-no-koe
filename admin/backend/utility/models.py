from django.db import models
from django.conf import settings

class Contact(models.Model):
    """
    お問い合わせテーブル
    """
    # 投稿機能（Post）と同じように、文字列で 'accounts.MobileUser' を指定する
    user = models.ForeignKey(
        'accounts.MobileUser', 
        on_delete=models.CASCADE, 
        verbose_name='会員'
    )
    
    email = models.EmailField(verbose_name='メールアドレス')
    message = models.TextField(verbose_name='お問い合わせ内容')
    created_at = models.DateTimeField(verbose_name='送信日時', auto_now_add=True)

    class Meta:
        db_table = 'CONTACT'