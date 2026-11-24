import hashlib
import io
import json
from datetime import timedelta
from math import degrees
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlsplit

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import MobileSession, MobileUser
from .models import HiddenPost, Post
from .nearby import EARTH_RADIUS_METERS


AUTO_SOURCE = {'label': '© OpenAddresses contributors', 'url': 'https://openaddresses.io/'}
FACILITY_SOURCE = {'label': '© OpenStreetMap contributors', 'url': 'https://www.openstreetmap.org/copyright'}
GEOAPIFY_SOURCE = {
    'sourcename': 'openstreetmap', 'attribution': FACILITY_SOURCE['label'],
    'url': 'https://untrusted.invalid/',
}


@override_settings(GEOAPIFY_API_KEY='fixture-key')
class PlaceTagApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = MobileUser.objects.create_user(username='owner', email='owner@example.com')
        cls.other = MobileUser.objects.create_user(username='reader', email='reader@example.com')
        for user, token in ((cls.owner, 'owner-token'), (cls.other, 'reader-token')):
            MobileSession.objects.create(
                user=user, token_hash=hashlib.sha256(token.encode()).hexdigest(),
                expires_at=timezone.now() + timedelta(hours=1),
            )
        cls.post = Post.objects.create(
            user_id=cls.owner, message='投稿', latitude=0, longitude=0, is_public=True,
            place_name='南七瀬', place_attribution=AUTO_SOURCE,
        )

    def setUp(self):
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION='Bearer owner-token')
        self.detail = f'/api/posts/{self.post.pk}/'
        self.candidates = self.detail + 'place-candidates/'
        self.tag = self.detail + 'place-tag/'

    def feature(self, *, place_id='station-id', name='長野駅', meters=20, **extra):
        return {'type': 'Feature', 'properties': {
            'name': name, 'place_id': place_id, 'lat': degrees(meters / EARTH_RADIUS_METERS), 'lon': 0,
            'categories': ['public_transport', 'public_transport.train'], 'datasource': GEOAPIFY_SOURCE,
            **extra,
        }}

    def geoapify_response(self, *features):
        payload = {'type': 'FeatureCollection', 'features': features}
        return patch('posts.place_names.opener.open', return_value=io.BytesIO(json.dumps(payload).encode()))

    def request_parameters(self, request, path):
        url = urlsplit(request.call_args.args[0])
        self.assertEqual((url.scheme, url.netloc, url.path), ('https', 'api.geoapify.com', path))
        return parse_qs(url.query)

    def test_owner_search_uses_saved_coordinates_and_filters_provider_candidates(self):
        with self.geoapify_response(
            self.feature(place_id='boundary-id', meters=250, distance=1),
            self.feature(place_id='out-of-range', meters=250.01, distance=5),
            self.feature(place_id='unnamed-id', name=None),
            self.feature(place_id='invalid-coordinates', lat='NaN'),
            self.feature(place_id='disallowed-category', categories=['parking']),
            self.feature(place_id='no-source', datasource={}),
            self.feature(place_id='near-id', meters=26),
            self.feature(place_id='near-id', meters=21),
        ) as request:
            response = self.client.post(self.candidates, {'latitude': 45, 'longitude': 90}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        candidates = response.json()['candidates']
        self.assertEqual([(p['place_id'], p['distance_m']) for p in candidates], [('near-id', 21), ('boundary-id', 250)])
        self.assertEqual(candidates[0]['attribution'], FACILITY_SOURCE)
        self.assertEqual(candidates[0]['categories'], ['public_transport.train'])
        request.assert_called_once()
        parameters = self.request_parameters(request, '/v2/places')
        self.assertEqual(parameters['filter'], ['circle:0.0,0.0,250'])
        self.assertEqual(parameters['bias'], ['proximity:0.0,0.0'])
        self.assertEqual(parameters['limit'], ['20'])
        self.assertEqual(parameters['offset'], ['0'])
        self.assertIn('education.library', parameters['categories'][0].split(','))
        self.assertNotIn('name', parameters)
        self.assertEqual(response['Cache-Control'], 'private, no-store')

    def test_name_search_always_requests_geoapify_and_limits_results(self):
        with self.geoapify_response() as first_request:
            self.assertEqual(self.client.post(self.candidates, {}, format='json').json(), {'candidates': []})
        self.assertNotIn('name', self.request_parameters(first_request, '/v2/places'))

        facilities = [self.feature(place_id=f'facility-{i}', meters=i, name=f'ユメリア{i}') for i in range(23, 0, -1)]
        with self.geoapify_response(*facilities) as next_request:
            response = self.client.post(self.candidates, {'q': ' ユメリア '}, format='json')
        next_request.assert_called_once()
        self.assertEqual(self.request_parameters(next_request, '/v2/places')['name'], ['ユメリア'])
        self.assertEqual([p['distance_m'] for p in response.json()['candidates']], list(range(1, 21)))

    def test_owner_sets_replaces_and_resets_tag_without_changing_auto_place_or_gps(self):
        with self.geoapify_response(
            self.feature(place_id='unrelated', feature_type='building'),
            self.feature(place_id='canonical-id', name='長野駅（東口）', meters=250, feature_type='details'),
        ) as request:
            response = self.client.patch(self.tag, {
                'place_id': 'input-id', 'name': '偽名', 'latitude': 40, 'longitude': 150, 'distance_m': 0,
            }, format='json')
        self.assertEqual(self.request_parameters(request, '/v2/place-details')['id'], ['input-id'])
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.json(), {
            'manual_place': {'place_id': 'canonical-id', 'name': '長野駅（東口）', 'attribution': FACILITY_SOURCE},
            'place_display': {'mode': 'manual', 'label': '長野駅（東口）', 'attribution': FACILITY_SOURCE},
        })

        with self.geoapify_response(self.feature(place_id='second-id', name='ユメリア', feature_type='details')):
            second = self.client.patch(self.tag, {'place_id': 'second-id'}, format='json')
        self.assertEqual(second.json()['manual_place']['place_id'], 'second-id')
        self.assertEqual(self.client.get(self.detail).json()['place_display']['label'], 'ユメリア')

        with patch('posts.place_names.opener.open') as request:
            reset = self.client.patch(self.tag, {'place_id': None}, format='json')
        request.assert_not_called()
        self.assertEqual(reset.status_code, 200)
        self.assertEqual(reset.json(), {
            'manual_place': None, 'place_display': {'mode': 'auto', 'label': '南七瀬周辺', 'attribution': AUTO_SOURCE},
        })
        self.post.refresh_from_db()
        self.assertEqual((self.post.latitude, self.post.longitude), (0, 0))
        self.assertEqual((self.post.place_name, self.post.place_attribution), ('南七瀬', AUTO_SOURCE))
        self.assertIsNone(self.post.manual_place)

    def test_other_and_unauthenticated_clients_cannot_search_set_or_reset(self):
        with patch('posts.place_names.opener.open') as request:
            for token, status in (('reader-token', 404), (None, 401)):
                self.client.credentials(**({'HTTP_AUTHORIZATION': f'Bearer {token}'} if token else {}))
                self.assertEqual(self.client.post(self.candidates, {}, format='json').status_code, status)
                self.assertEqual(self.client.patch(self.tag, {'place_id': 'station-id'}, format='json').status_code, status)
                self.assertEqual(self.client.patch(self.tag, {'place_id': None}, format='json').status_code, status)
        request.assert_not_called()

    def test_invalid_place_ids_and_coordinates_are_rejected(self):
        with patch('posts.place_names.opener.open') as request:
            for place_id in ('', 'https://example.com', 17, False, ['station-id'], 'a' * 2049):
                self.assertEqual(self.client.patch(self.tag, {'place_id': place_id}, format='json').status_code, 400)
            self.assertEqual(self.client.patch(self.tag, {}, format='json').status_code, 400)
        request.assert_not_called()

        bad_id = HTTPError('', 400, '', {}, None)
        with patch('posts.place_names.opener.open', side_effect=bad_id):
            self.assertEqual(self.client.patch(self.tag, {'place_id': 'bad-id'}, format='json').status_code, 400)
        for feature in (
            self.feature(meters=250.01, distance=1, feature_type='details'),
            self.feature(lat=None, feature_type='details'),
            self.feature(name='', feature_type='details'),
            self.feature(categories=['administrative'], feature_type='details'),
        ):
            with self.subTest(feature=feature), self.geoapify_response(feature):
                self.assertEqual(self.client.patch(self.tag, {'place_id': 'station-id'}, format='json').status_code, 400)
        self.post.refresh_from_db()
        self.assertIsNone(self.post.manual_place)

    def test_lookup_failure_preserves_saved_tag_and_does_not_affect_reading(self):
        old_tag = {'place_id': 'old-id', 'name': '以前の施設', 'attribution': FACILITY_SOURCE}
        Post.objects.filter(pk=self.post.pk).update(manual_place=old_tag)
        for failure in (TimeoutError(), HTTPError('', 429, '', {}, None)):
            with self.subTest(failure=failure), patch('posts.place_names.opener.open', side_effect=failure) as request:
                self.assertEqual(self.client.post(self.candidates, {}, format='json').status_code, 503)
                self.assertEqual(self.client.patch(self.tag, {'place_id': 'new-id'}, format='json').status_code, 503)
                self.assertEqual(self.client.get(self.detail).json()['manual_place'], old_tag)
                self.assertEqual(request.call_count, 2)
        self.post.refresh_from_db()
        self.assertEqual(self.post.manual_place, old_tag)
        self.assertEqual(self.post.place_name, '南七瀬')

    def test_legacy_post_with_no_coordinates_keeps_auto_fallback(self):
        Post.objects.filter(pk=self.post.pk).update(latitude=None, longitude=None, place_name='', place_attribution=None)
        with patch('posts.place_names.opener.open') as request:
            self.assertEqual(self.client.post(self.candidates, {}, format='json').status_code, 400)
            self.assertEqual(self.client.patch(self.tag, {'place_id': 'station-id'}, format='json').status_code, 400)
            self.assertEqual(self.client.patch(self.tag, {'place_id': None}, format='json').status_code, 200)
            self.assertEqual(self.client.get(self.detail).json()['place_display']['label'], 'この付近')
        request.assert_not_called()

    def test_manual_tag_is_exposed_only_in_readable_details(self):
        manual_tag = {'place_id': 'station-id', 'name': '長野駅', 'attribution': FACILITY_SOURCE}
        Post.objects.filter(pk=self.post.pk).update(manual_place=manual_tag)
        own_list = self.client.get('/api/posts/').json()
        self.assertNotIn('manual_place', own_list[0])

        self.client.credentials(HTTP_AUTHORIZATION='Bearer reader-token')
        headers = {'HTTP_X_VIEWER_LATITUDE': '0', 'HTTP_X_VIEWER_LONGITUDE': '0'}
        readable = self.client.get(self.detail, **headers)
        self.assertEqual(readable.json()['manual_place'], manual_tag)
        for key in ('pins', 'posts'):
            self.assertNotIn('manual_place', self.client.get('/api/posts/public/', **headers).json()[key][0])
        distant = self.client.get(self.detail, **{**headers, 'HTTP_X_VIEWER_LATITUDE': '1'})
        self.assertEqual(distant.status_code, 404)
        self.assertNotIn('manual_place', distant.json())
        self.assertEqual(self.client.get(self.detail).status_code, 400)

        Post.objects.filter(pk=self.post.pk).update(is_public=False)
        self.assertEqual(self.client.get(self.detail, **headers).status_code, 404)
        Post.objects.filter(pk=self.post.pk).update(is_public=True, admin_hidden_at=timezone.now())
        self.assertEqual(self.client.get(self.detail, **headers).status_code, 404)
        Post.objects.filter(pk=self.post.pk).update(admin_hidden_at=None)
        HiddenPost.objects.create(user_id=self.other, post_id_id=self.post.pk)
        self.assertEqual(self.client.get(self.detail, **headers).status_code, 404)
