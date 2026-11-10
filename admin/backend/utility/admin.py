from django.contrib import admin
from .models import Contact

@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    """
    Django管理画面でお問い合わせ一覧を見やすく管理するための設定
    """
    # 管理画面の一覧に表示する項目
    list_display = ('id', 'user', 'short_message', 'created_at')
    
    # 右側に表示する絞り込みフィルター（送信日時順）
    list_filter = ('created_at',)
    
    # 検索窓で検索できる対象（メッセージ内容、ユーザー名、メールアドレス）
    search_fields = ('message', 'user__username', 'user__email')
    
    # 管理画面上では変更不可（閲覧のみ）にする項目
    readonly_fields = ('created_at',)

    def short_message(self, obj):
        """一覧画面でメッセージが長すぎるときに30文字で省略して表示するカスタム関数"""
        return obj.message[:30] + '...' if len(obj.message) > 30 else obj.message
    short_message.short_description = "内容"