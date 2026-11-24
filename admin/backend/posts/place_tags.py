"""Look up and verify facilities for manually selected post tags."""
import re

from .nearby import distance_meters, validated_coordinates
from .place_names import PostPlaceServiceError, _clean_text, geoapify_attribution, request_geoapify_json


PLACES_URL = 'https://api.geoapify.com/v2/places'
PLACE_DETAILS_URL = 'https://api.geoapify.com/v2/place-details'
PLACE_TAG_RADIUS_METERS = 250
PLACE_CANDIDATE_LIMIT = 20
MAX_PLACES_RESPONSE_BYTES = 1024 * 1024
FACILITY_CATEGORIES = (
    'public_transport.train', 'public_transport.subway', 'leisure.park',
    'commercial.shopping_mall', 'commercial.department_store',
    'catering.restaurant', 'catering.cafe', 'tourism.attraction',
    'tourism.sights', 'entertainment.museum', 'education.library',
)
PLACE_ID_PATTERN = re.compile(r'[A-Za-z0-9_-]{2,2048}')


def valid_place_id(value):
    return isinstance(value, str) and PLACE_ID_PATTERN.fullmatch(value) is not None


def _facility_features(endpoint, parameters):
    response = request_geoapify_json(endpoint, parameters, strict=True, max_response_bytes=MAX_PLACES_RESPONSE_BYTES)
    if response.get('type') != 'FeatureCollection' or not isinstance(response.get('features'), list):
        raise PostPlaceServiceError('Invalid Places response.')
    for feature in response['features']:
        properties = feature.get('properties') if isinstance(feature, dict) else None
        if isinstance(properties, dict):
            yield properties


def _verified_facility(properties, post_coordinates):
    name = properties.get('name')
    place_id = properties.get('place_id')
    attribution = geoapify_attribution(properties)
    coordinates = validated_coordinates((properties.get('lat'), properties.get('lon')))
    categories = properties.get('categories')
    if not _clean_text(name, max_length=200) or not valid_place_id(place_id) or not attribution or coordinates is None:
        return None
    if not isinstance(categories, list):
        return None
    supported = [
        category for category in categories
        if isinstance(category, str) and any(
            category == root or category.startswith(root + '.') for root in FACILITY_CATEGORIES
        )
    ]
    if not supported:
        return None

    distance = distance_meters(*post_coordinates, *coordinates)
    if distance > PLACE_TAG_RADIUS_METERS + 1e-7:
        return None
    return {
        'place_id': place_id, 'name': name.strip(), 'attribution': attribution,
        'categories': supported, 'distance_m': distance,
    }


def search_place_candidates(post_coordinates, term, *, offset=0):
    lat, lon = post_coordinates
    parameters = {
        'categories': ','.join(FACILITY_CATEGORIES),
        'filter': f'circle:{lon},{lat},{PLACE_TAG_RADIUS_METERS}',
        'bias': f'proximity:{lon},{lat}',
        'limit': PLACE_CANDIDATE_LIMIT,
        'offset': offset,
        'lang': 'ja',
    }
    if term:
        parameters['name'] = term

    facilities = {}
    for properties in _facility_features(PLACES_URL, parameters):
        facility = _verified_facility(properties, post_coordinates)
        if facility:
            identifier = facility['place_id']
            if identifier not in facilities or facility['distance_m'] < facilities[identifier]['distance_m']:
                facilities[identifier] = facility
    candidates = sorted(facilities.values(), key=lambda facility: facility['distance_m'])[:PLACE_CANDIDATE_LIMIT]
    for facility in candidates:
        facility['distance_m'] = round(facility['distance_m'], 2)
    return candidates


def verify_manual_place(place_id, post_coordinates):
    try:
        for properties in _facility_features(PLACE_DETAILS_URL, {'id': place_id, 'lang': 'ja'}):
            if properties.get('feature_type') == 'details':
                facility = _verified_facility(properties, post_coordinates)
                if facility:
                    # Geoapify may return a canonical ID different from the requested one.
                    return {field: facility[field] for field in ('place_id', 'name', 'attribution')}
                return None
    except PostPlaceServiceError as error:
        if error.http_status not in (400, 404):
            raise
    return None
