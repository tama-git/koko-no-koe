from rest_framework import serializers
from .models import Post
from django.urls import reverse

class PostSerializer(serializers.ModelSerializer):
    """
    投稿テーブル シリアライザ
    """
    is_published = serializers.BooleanField(source='is_public', required=True)
    latitude = serializers.DecimalField(max_digits=10, decimal_places=7, min_value=-90, max_value=90, coerce_to_string=False)
    longitude = serializers.DecimalField(max_digits=10, decimal_places=7, min_value=-180, max_value=180, coerce_to_string=False)
    message = serializers.CharField(required=False, allow_blank=True, default='')
    image = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = Post
        fields = ('id', 'message', 'image', 'latitude', 'longitude', 'is_published', 'created_at')
        read_only_fields = ('id', 'created_at')

    def validate(self, attrs):
        request = self.context.get('request')
        if request is not None and len(request.FILES.getlist('image')) > 1:
            raise serializers.ValidationError('写真は1枚まで添付できます。')
        if not attrs.get('message', '').strip() and not attrs.get('image'):
            raise serializers.ValidationError('メッセージまたは写真を入力してください。')
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.image:
            # 保存先を直接公開せず、本人の認証が必要な画像取得URLを返す。
            data['image'] = self.context['request'].build_absolute_uri(reverse('post-image', args=[instance.pk]))
        return data
