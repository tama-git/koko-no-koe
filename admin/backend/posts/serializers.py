from rest_framework import serializers
from .images import InvalidPostPhoto, normalize_post_photo
from .models import Post, PostReport
from django.urls import reverse

class PostSerializer(serializers.ModelSerializer):
    """
    投稿テーブル シリアライザ
    """
    is_published = serializers.BooleanField(source='is_public', required=True)
    latitude = serializers.DecimalField(max_digits=10, decimal_places=7, min_value=-90, max_value=90, coerce_to_string=False)
    longitude = serializers.DecimalField(max_digits=10, decimal_places=7, min_value=-180, max_value=180, coerce_to_string=False)
    message = serializers.CharField(required=False, allow_blank=True, default='')
    image = serializers.FileField(required=False, allow_null=True)
    is_admin_hidden = serializers.BooleanField(read_only=True)
    is_own = serializers.SerializerMethodField()
    
    class Meta:
        model = Post
        fields = ('id', 'message', 'image', 'latitude', 'longitude', 'is_published', 'is_admin_hidden', 'created_at', 'is_own')
        read_only_fields = ('id', 'created_at')

    def get_is_own(self, obj):
        request = self.context.get('request')
        if request is not None and request.user.is_authenticated:
            return obj.user_id_id == request.user.pk
        return False

    def validate(self, attrs):
        request = self.context.get('request')
        if request is not None and len(request.FILES.getlist('image')) > 1:
            raise serializers.ValidationError('写真は1枚まで添付できます。')
        if not attrs.get('message', '').strip() and not attrs.get('image'):
            raise serializers.ValidationError('メッセージまたは写真を入力してください。')
        if attrs.get('image'):
            try:
                attrs['image'] = normalize_post_photo(attrs['image'])
            except InvalidPostPhoto as error:
                raise serializers.ValidationError({'image': str(error)}) from error
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.image:
            # 保存先を直接公開せず、認証と閲覧条件を確認する画像取得URLを返す。
            data['image'] = self.context['request'].build_absolute_uri(reverse('post-image', args=[instance.pk]))
        return data


class PostDetailSerializer(PostSerializer):
    can_report = serializers.SerializerMethodField()

    class Meta(PostSerializer.Meta):
        fields = (*PostSerializer.Meta.fields, 'can_report', 'place_name', 'place_attribution')
        read_only_fields = (*PostSerializer.Meta.read_only_fields, 'place_name', 'place_attribution')

    def get_can_report(self, post):
        return post.is_public is True and not post.is_admin_hidden and post.user_id_id != self.context['request'].user.pk


class PostReportSerializer(serializers.Serializer):
    category = serializers.ChoiceField(choices=PostReport.Category.choices)
    details = serializers.CharField(max_length=100, allow_blank=True, default='')

    def validate(self, attrs):
        if attrs['category'] == PostReport.Category.OTHER and not attrs['details']:
            raise serializers.ValidationError({'details': 'その他を選んだ場合は理由を入力してください。'})
        return attrs
