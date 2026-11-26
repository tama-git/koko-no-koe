"""Derive a display label from a saved post location."""
import json
import logging
import re
import unicodedata
from http.client import HTTPException
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, build_opener

from django.conf import settings
from django.core.cache import cache
from django.utils.crypto import salted_hmac

from .nearby import distance_meters, validated_coordinates


logger = logging.getLogger(__name__)
REVERSE_GEOCODING_URL = 'https://api.geoapify.com/v1/geocode/reverse'
LOOKUP_TIMEOUT_SECONDS = 2
MAX_RESPONSE_BYTES = 64 * 1024
MAX_RESULTS = 3
PLACE_CACHE_SECONDS = 30 * 60
EMPTY_PLACE_CACHE_SECONDS = 60
PLACE_LOOKUP_LOCK_SECONDS = 30
CACHE_MISS = object()
JAPANESE_STREET_RADIUS_METERS = 100
SOURCE_URLS = {
    'openstreetmap': 'https://www.openstreetmap.org/copyright',
    'openaddresses': 'https://openaddresses.io/',
    'geonames': 'https://www.geonames.org/',
    'whosonfirst': 'https://whosonfirst.org/',
}
CHOME_SUFFIX = re.compile(r'\s*[0-9〇零一二三四五六七八九十百]+丁目$')
JAPANESE_NAME = re.compile(r'[一-龯々〆ヶヵ〇ぁ-んァ-ヺー・ \-0-9]+')
STREET_TERMS = re.compile(r'道路|街道|国道|県道|都道|道道|府道|市道|町道|村道|高速|通り|通$|線$|番地|丁目')
NUMBERED_DISTRICT = re.compile(r'([0-9]{1,3})(?:区|(?:st|nd|rd|th)?\s+arr(?:ondissement)?\.?)', re.IGNORECASE)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


opener = build_opener(NoRedirect())


class PostPlaceServiceError(Exception):
    """A service failure that does not contain request data."""

    def __init__(self, reason, *, http_status=None):
        super().__init__(reason)
        self.http_status = http_status


def _service_failure(reason, strict, *, http_status=None):
    # URL・例外本文には投稿座標やキーが含まれるため記録しない。
    logger.warning('Geoapify: %s', reason)
    if strict:
        raise PostPlaceServiceError(reason, http_status=http_status) from None


def _clean_text(value, max_length=100):
    if not isinstance(value, str) or any(unicodedata.category(char).startswith('C') for char in value):
        return ''
    value = ' '.join(unicodedata.normalize('NFKC', value).split())
    if not value or len(value) > max_length or '<' in value or '>' in value:
        return ''
    return value


def geoapify_attribution(result):
    source = result.get('datasource')
    if not isinstance(source, dict):
        return None
    label = _clean_text(source.get('attribution'), max_length=200)
    if not label:
        return None
    key = _clean_text(source.get('sourcename')).lower()
    return {'label': label, 'url': SOURCE_URLS.get(key)}


def _japanese_municipality(result):
    names = [_clean_text(result.get(field)) for field in ('district', 'county', 'city')]
    return next((name for name in names if name.endswith(('市', '区', '町', '村')) and len(name) > 1), names[-1])


def _japanese_town(value, *, from_street=False):
    name = _clean_text(value)
    has_aza_prefix = name.startswith('大字')
    name = name.removeprefix('大字').strip()
    name, removed_chome = CHOME_SUFFIX.subn('', name)
    if from_street and not (has_aza_prefix or removed_chome):
        return ''
    if not JAPANESE_NAME.fullmatch(name) or STREET_TERMS.search(name):
        return ''
    if not name[0].isdigit() and not name[-1].isdigit():
        return name
    return ''


def _nearby_japanese_town(result, coordinates):
    point = validated_coordinates((result.get('lat'), result.get('lon')))
    if (
        result.get('country_code') != 'jp'
        or point is None
        or distance_meters(*coordinates, *point) > JAPANESE_STREET_RADIUS_METERS + 1e-7
    ):
        return ''
    municipality = _japanese_municipality(result)
    for field in ('district', 'suburb', 'quarter', 'neighbourhood'):
        town = _japanese_town(result.get(field))
        if town and town != municipality:
            return town
    if result.get('result_type') == 'building':
        town = _japanese_town(result.get('street'), from_street=True)
        if town != municipality:
            return town
    return ''


def _foreign_place(result):
    city = _clean_text(result.get('city'))
    for field in ('district', 'suburb', 'quarter', 'neighbourhood'):
        name = _clean_text(result.get(field))
        if not name or name.casefold() == city.casefold():
            continue
        numbered = NUMBERED_DISTRICT.fullmatch(name)
        if numbered:
            if city:
                return f'{city}{numbered[1]}区' if name.endswith('区') else f'{city} {name}'
            continue
        if len(name) >= 2 and any(char.isalpha() for char in name):
            return name
    return city or _clean_text(result.get('county'))


def _select_place(results, coordinates):
    if not isinstance(results, list) or not results or not isinstance(results[0], dict):
        return None
    result = results[0]
    attribution = geoapify_attribution(result)
    if attribution is None:
        return None
    if result.get('country_code') == 'jp':
        name = _nearby_japanese_town(result, coordinates)
        if name:
            other_towns = {
                _nearby_japanese_town(other, coordinates) for other in results[1:MAX_RESULTS]
                if isinstance(other, dict)
            }
            if other_towns - {'', name}:
                name = ''  # 近くで異なる町名が返る場合は、市区町村を使用する。
        name = name or _japanese_municipality(result)
    else:
        name = _foreign_place(result)
    name = _clean_text(name)
    return (name, attribution) if name else None


def request_geoapify_json(endpoint, parameters, *, strict=False, max_response_bytes=MAX_RESPONSE_BYTES):
    api_key = settings.GEOAPIFY_API_KEY
    if not api_key:
        _service_failure('GEOAPIFY_API_KEY is not configured.', strict)
        return None
    query = urlencode({**parameters, 'apiKey': api_key})
    try:
        with opener.open(f'{endpoint}?{query}', timeout=LOOKUP_TIMEOUT_SECONDS) as response:
            data = response.read(max_response_bytes + 1)
    except HTTPError as error:
        _service_failure(f'HTTP {error.code}.', strict, http_status=error.code)
        return None
    except (OSError, HTTPException) as error:
        reason = error.reason if isinstance(error, URLError) else error
        message = 'Connection timed out.' if isinstance(reason, TimeoutError) else 'Connection failed.'
        _service_failure(message, strict)
        return None
    try:
        payload = json.loads(data) if len(data) <= max_response_bytes else None
    except (ValueError, RecursionError):
        payload = None
    if not isinstance(payload, dict):
        _service_failure('Invalid response.', strict)
        return None
    return payload


def lookup_post_place(latitude, longitude, *, strict=False):
    coordinates = validated_coordinates((latitude, longitude))
    if coordinates is None:
        return None
    payload = request_geoapify_json(REVERSE_GEOCODING_URL, {
        'lat': latitude,
        'lon': longitude,
        'lang': 'ja',
        'format': 'json',
        'limit': MAX_RESULTS,
    }, strict=strict)
    if payload is None:
        return None
    if not isinstance(payload.get('results'), list):
        _service_failure('Invalid response.', strict)
        return None
    place = _select_place(payload['results'], coordinates)
    if place is None:
        logger.warning('Geoapify: No usable place name and attribution.')
    return place


def lookup_cached_post_place(user_id, latitude, longitude):
    # 確認APIと投稿APIは小数7桁のDecimalに揃える。-0と+0は同じ地点として扱う。
    coordinates = f'{latitude or 0:.7f}:{longitude or 0:.7f}'
    fingerprint = salted_hmac('posts.place-preview.v1', f'{user_id}:{coordinates}').hexdigest()
    key = f'post-place:{fingerprint}'
    place = cache.get(key, CACHE_MISS)
    if place is not CACHE_MISS:
        return place

    lock_key = f'{key}:lookup'
    if not cache.add(lock_key, True, timeout=PLACE_LOOKUP_LOCK_SECONDS):
        # 別リクエストが照会中なら、追加の照会を起こさない。
        return cache.get(key)

    try:
        place = cache.get(key, CACHE_MISS)
        if place is CACHE_MISS:
            place = lookup_post_place(latitude, longitude)
            timeout = EMPTY_PLACE_CACHE_SECONDS if place is None else PLACE_CACHE_SECONDS
            cache.set(key, place, timeout=timeout)
        return place
    finally:
        cache.delete(lock_key)
