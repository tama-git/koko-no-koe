from posts.authentication import MobileBearerAuthentication
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics
from django.views.generic import DetailView
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from accounts.admin_side.views import admin_required
from .serializers import ContactSerializer
from .models import Contact  # お問い合わせモデルのインポート

class ContactCreateView(APIView):
    # 💡 投稿機能と同じカスタム認証クラスを指定する！
    authentication_classes = [MobileBearerAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # 1. フロントエンドから送られてきたメッセージを取得
        message = request.data.get('message')

        if not message:
            return Response(
                {"error": "お問い合わせ内容を入力してください。"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. 認証されたログイン中のユーザー（request.user）を自動取得
        user = request.user

        try:
            # 3. データベースに保存（user と、ユーザーが持つ email を自動設定）
            contact = Contact.objects.create(
                user=user,
                email=getattr(user, 'email', ''),  # 会員モデルのメールアドレスを自動紐づけ
                message=message
            )
            
            return Response(
                {
                    "message": "お問い合わせが正常に送信されました！",
                    "id": contact.id
                }, 
                status=status.HTTP_201_CREATED
            )
            
        except Exception as e:
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class ContactAdminListView(generics.ListAPIView):
    """
    管理者向け：お問い合わせ一覧取得API
    """
    queryset = Contact.objects.all().order_by('-created_at')
    serializer_class = ContactSerializer
    # 管理者権限（必要に応じてプロジェクトの管理者用認証クラスに変更可能です）
    permission_classes = [IsAdminUser]

# utility/views.py の ContactDetailView 部分
@method_decorator([never_cache, admin_required], name='dispatch')
class ContactDetailView(DetailView):
    """
    管理者向け：お問い合わせ詳細画面
    """
    model = Contact
    template_name = 'admin_side/contact_detail.html'
    context_object_name = 'contact'
