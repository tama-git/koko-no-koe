"""モバイル会員に投稿の本文・写真を返せる範囲を絞り込む。"""
from accounts.models import MobileUser

from .models import HiddenPost
from .nearby import validated_coordinates, within_radius


READ_RADIUS_METERS = 250


def readable_posts(queryset, viewer, coordinates=None, *, include_owned=True):
    """認証済みの会員と取得座標で絞り込む。単一投稿の場合は先にIDで絞る。"""
    if not isinstance(viewer, MobileUser) or viewer.pk is None or not viewer.is_active:
        return queryset.none()

    owned = queryset.filter(user_id=viewer) if include_owned else queryset.none()
    coordinates = validated_coordinates(coordinates)
    if coordinates is None:
        return owned

    public = visible_public_posts(queryset, viewer)
    return owned | within_radius(public, coordinates, READ_RADIUS_METERS)


def visible_public_posts(queryset, viewer):
    # 公開投稿から、管理者非表示と閲覧者本人が個別に非表示にした投稿を除く。
    hidden = HiddenPost.objects.filter(user_id=viewer).values('post_id')
    return queryset.filter(is_public=True, admin_hidden_at__isnull=True).exclude(pk__in=hidden)
