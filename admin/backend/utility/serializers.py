from rest_framework import serializers
from .models import Contact

class ContactSerializer(serializers.ModelSerializer):
    # 会員のメールアドレスを分かりやすく含める
    user_email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = Contact
        fields = ['id', 'user', 'user_email', 'email', 'message', 'created_at']
        read_only_fields = ['id', 'created_at']