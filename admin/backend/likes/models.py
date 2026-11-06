from django.db import models

# 使用できるリアクションの一覧。
# '.' は「リアクションなし」を表す内部値で、画面には表示しない。
REACTION_EMOJIS = ['.', '❤️', '👍', '😭', '😮', '😆']


class PostReaction(models.Model):
    """投稿へのリアクション。1人につき1投稿に1つまで登録できる。"""

    # リアクション対象の投稿
    post = models.ForeignKey('posts.Post', on_delete=models.CASCADE, related_name='reactions')
    # リアクションした会員
    user = models.ForeignKey('accounts.MobileUser', on_delete=models.CASCADE, related_name='reactions')
    # 選んだ絵文字（REACTION_EMOJIS の中から1つ）
    emoji = models.CharField(max_length=8, choices=[(e, e) for e in REACTION_EMOJIS])

    class Meta:
        db_table = 'POST_REACTION'
        constraints = [
            # 同じ会員が同じ投稿に2つ以上リアクションできないようにする
            models.UniqueConstraint(fields=['post', 'user'], name='unique_reaction_per_post'),
        ]
