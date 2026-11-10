from posts.authentication import MobileBearerAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
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