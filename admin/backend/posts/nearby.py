"""SQLiteでも使える距離計算。現在地はDBに保存しない。"""
import math

from rest_framework.exceptions import ValidationError


EARTH_RADIUS_METERS = 6371008.8


def viewer_coordinates(request, required=False):
    values = (request.headers.get('X-Viewer-Latitude'), request.headers.get('X-Viewer-Longitude'))
    if not required and values == (None, None):
        return None
    try:
        latitude, longitude = map(float, values)
        if not (math.isfinite(latitude) and math.isfinite(longitude)
                and -90 <= latitude <= 90 and -180 <= longitude <= 180):
            raise ValueError
        return latitude, longitude
    except (ValueError, TypeError, OverflowError):
        # 不正値・現在地そのものを応答やログに出さない。
        raise ValidationError('有効な現在地の緯度・経度が必要です。')


def distance_meters(latitude, longitude, other_latitude, other_longitude):
    lat1, lat2 = map(math.radians, (latitude, other_latitude))
    delta_lat = lat2 - lat1
    delta_lon = math.radians(other_longitude - longitude)
    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    return 2 * EARTH_RADIUS_METERS * math.asin(math.sqrt(min(1, max(0, a))))


def within_radius(queryset, coordinates, radius_meters):
    latitude, longitude = coordinates
    delta = math.degrees(radius_meters / EARTH_RADIUS_METERS)
    # 先に緯度の帯で候補を絞り、距離は球面上で計算（日付変更線にも対応）。
    candidates = queryset.filter(latitude__gte=latitude - delta - 1e-9,
                                 latitude__lte=latitude + delta + 1e-9,
                                 longitude__gte=-180, longitude__lte=180)
    ids = [pk for pk, lat, lon in candidates.values_list('pk', 'latitude', 'longitude')
           if distance_meters(latitude, longitude, float(lat), float(lon)) <= radius_meters + 1e-7]
    return queryset.filter(pk__in=ids)
