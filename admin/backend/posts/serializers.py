from rest_framework import serializers
from .images import InvalidPostPhoto, normalize_post_photo
from .models import Post, PostReport
from .place_tags import valid_place_id
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
        # 閲覧している会員が投稿者本人かを判定する。
        request = self.context.get('request')
        if request is not None and request.user.is_authenticated:
            return obj.user_id_id == request.user.pk
        return False

    def validate(self, attrs):
        # 本文または写真があることと写真の枚数を確認し、添付写真を保存用に変換する。
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
        # 保存された投稿を応答に変換し、写真があれば閲覧権限を確認する取得先を返す。
        data = super().to_representation(instance)
        if instance.image:
            # 保存先を直接公開せず、認証と閲覧条件を確認する画像取得URLを返す。
            data['image'] = self.context['request'].build_absolute_uri(reverse('post-image', args=[instance.pk]))
        return data


class PostListSerializer(PostSerializer):
    place_display = serializers.ReadOnlyField()

    class Meta(PostSerializer.Meta):
        fields = (*PostSerializer.Meta.fields, 'place_display')


class PostDetailSerializer(PostListSerializer):
    can_report = serializers.SerializerMethodField()

    class Meta(PostListSerializer.Meta):
        fields = (*PostListSerializer.Meta.fields, 'can_report', 'place_name', 'place_attribution', 'manual_place')
        read_only_fields = (*PostListSerializer.Meta.read_only_fields, 'place_name', 'place_attribution', 'manual_place')

    def get_can_report(self, post):
        # 閲覧中の投稿に対して通報操作を表示できるか判定する。
        return post.is_public is True and not post.is_admin_hidden and post.user_id_id != self.context['request'].user.pk


class PostPlaceSearchSerializer(serializers.Serializer):
    q = serializers.CharField(max_length=100, allow_blank=True, default='')


class PostPlacePreviewSerializer(serializers.Serializer):
    latitude = serializers.DecimalField(max_digits=10, decimal_places=7, min_value=-90, max_value=90)
    longitude = serializers.DecimalField(max_digits=10, decimal_places=7, min_value=-180, max_value=180)


class PostPlaceTagSerializer(serializers.Serializer):
    place_id = serializers.JSONField(allow_null=True)

    def validate_place_id(self, value):
        # 施設IDの形式を確認し、自動設定に戻す指定として空の値も受け付ける。
        if value is not None and not valid_place_id(value):
            raise serializers.ValidationError('有効な施設IDを指定してください。')
        return value


class PostReportSerializer(serializers.Serializer):
    category = serializers.ChoiceField(choices=PostReport.Category.choices)
    details = serializers.CharField(max_length=100, allow_blank=True, default='')

    def validate(self, attrs):
        # 通報で「その他」を選んだ場合に、補足が入力されていることを確認する。
        if attrs['category'] == PostReport.Category.OTHER and not attrs['details']:
            raise serializers.ValidationError({'details': 'その他を選んだ場合は理由を入力してください。'})
        return attrs
