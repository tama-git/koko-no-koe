import json
from io import BytesIO, StringIO
from math import degrees
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlsplit

from django.core.management import call_command, CommandError
from django.test import SimpleTestCase, TestCase, override_settings

from accounts.models import MobileUser

from .models import Post
from .nearby import EARTH_RADIUS_METERS
from .place_names import PostPlaceServiceError, lookup_post_place


OPEN_ADDRESSES = {'sourcename': 'openaddresses', 'attribution': '© OpenAddresses contributors'}
OPEN_STREET_MAP = {'sourcename': 'openstreetmap', 'attribution': '© OpenStreetMap contributors'}


@override_settings(GEOAPIFY_API_KEY='test-key')
class PostPlaceLookupTests(SimpleTestCase):
    def japanese_address(self, street, meters=30, **overrides):
        return {
            'country_code': 'jp',
            'lat': 36 + degrees(meters / EARTH_RADIUS_METERS),
            'lon': 138,
            'city': '長野',
            'county': '長野市',
            'street': street,
            'result_type': 'building',
            'datasource': OPEN_ADDRESSES,
            **overrides,
        }

    def lookup(self, *results):
        body = json.dumps({'results': results}).encode()
        with patch('posts.place_names.opener.open', return_value=BytesIO(body)) as request:
            result = lookup_post_place(36, 138)
        url = urlsplit(request.call_args.args[0])
        self.assertEqual((url.scheme, url.netloc, url.path), ('https', 'api.geoapify.com', '/v1/geocode/reverse'))
        self.assertEqual(parse_qs(url.query), {
            'lat': ['36'], 'lon': ['138'], 'lang': ['ja'],
            'format': ['json'], 'limit': ['3'], 'apiKey': ['test-key'],
        })
        self.assertEqual(request.call_args.kwargs['timeout'], 2)
        return result

    def test_japanese_streets_need_a_town_pattern_and_a_nearby_address(self):
        for street, expected in (
            ('大字栗田', '栗田'), ('平林二丁目', '平林'), ('箱清水１丁目', '箱清水'),
            ('中央通り', '長野市'), ('中央通り二丁目', '長野市'), ('栗田452-1', '長野市'),
        ):
            with self.subTest(street=street):
                name, source = self.lookup(self.japanese_address(street))
                self.assertEqual(name, expected)
                self.assertEqual(source, {'label': '© OpenAddresses contributors', 'url': 'https://openaddresses.io/'})
        self.assertEqual(self.lookup(self.japanese_address('大字栗田', meters=100))[0], '栗田')
        self.assertEqual(self.lookup(self.japanese_address('大字栗田', meters=100.01))[0], '長野市')
        self.assertEqual(self.lookup(self.japanese_address('大字栗田', lat=None))[0], '長野市')
        self.assertEqual(self.lookup(self.japanese_address('大字栗田', result_type='street'))[0], '長野市')

    def test_structured_town_and_conflicting_nearby_towns(self):
        kurita = self.japanese_address('道路', district='大字栗田')
        self.assertEqual(self.lookup(kurita, self.japanese_address('大字栗田'))[0], '栗田')
        hirabayashi = self.japanese_address('平林二丁目', meters=80)
        self.assertEqual(self.lookup(kurita, hirabayashi)[0], '長野市')
        tokyo = self.japanese_address('代々木神園町', meters=194, district='渋谷区', city='東京', county='渋谷区')
        self.assertEqual(self.lookup(tokyo)[0], '渋谷区')

    def test_overseas_district_and_city_fallback(self):
        for address, expected in (
            ({'district': 'マンハッタン', 'suburb': 'Midtown West', 'city': 'ニューヨーク'}, 'マンハッタン'),
            ({'district': 'パリ', 'suburb': '7区', 'city': 'パリ'}, 'パリ7区'),
            ({'district': '7th Arr.', 'city': 'Paris'}, 'Paris 7th Arr.'),
            ({'district': '7区', 'county': 'Paris'}, 'Paris'),
            ({'district': '', 'city': 'São Paulo', 'name': '建物名'}, 'São Paulo'),
        ):
            with self.subTest(address=address):
                name, source = self.lookup({**address, 'datasource': OPEN_STREET_MAP})
                self.assertEqual(name, expected)
                self.assertEqual(source['url'], 'https://www.openstreetmap.org/copyright')

    def test_missing_or_invalid_response_uses_no_label(self):
        self.assertIsNone(self.lookup())
        self.assertIsNone(self.lookup({'name': '建物名', 'datasource': OPEN_STREET_MAP}))
        self.assertIsNone(self.lookup({'city': 'パリ'}))
        with patch('posts.place_names.opener.open', return_value=BytesIO(b'not json')):
            self.assertIsNone(lookup_post_place(36, 138))
        with patch('posts.place_names.opener.open', side_effect=HTTPError('', 429, '', {}, None)):
            self.assertIsNone(lookup_post_place(36, 138))
        with patch('posts.place_names.opener.open', side_effect=TimeoutError):
            self.assertIsNone(lookup_post_place(36, 138))

    def test_skips_network_without_a_key_or_valid_coordinates(self):
        with patch('posts.place_names.opener.open') as request:
            self.assertIsNone(lookup_post_place(None, 138))
            self.assertIsNone(lookup_post_place(91, 138))
            with self.settings(GEOAPIFY_API_KEY=''):
                self.assertIsNone(lookup_post_place(36, 138))
        request.assert_not_called()

    def test_service_failure_reports_only_the_status(self):
        error = HTTPError('https://example.invalid/?apiKey=test-key&lat=36&lon=138', 403, 'error detail', {}, None)
        with patch('posts.place_names.opener.open', side_effect=error), self.assertLogs('posts.place_names') as logs:
            self.assertIsNone(lookup_post_place(36, 138))
            with self.assertRaisesMessage(PostPlaceServiceError, 'HTTP 403.'):
                lookup_post_place(36, 138, strict=True)
        self.assertEqual([record.getMessage() for record in logs.records], ['Geoapify: HTTP 403.'] * 2)


@override_settings(GEOAPIFY_API_KEY='test-key')
class BackfillPostPlacesTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        owner = MobileUser.objects.create_user(username='location-writer', email='location@example.com')
        cls.first = Post.objects.create(user_id=owner, latitude=36, longitude=138, is_public=True)
        cls.second = Post.objects.create(user_id=owner, latitude=37, longitude=139, is_public=False)
        cls.saved = Post.objects.create(user_id=owner, latitude=36, longitude=138, place_name='保存済み')
        cls.no_coordinates = Post.objects.create(user_id=owner)

    def test_preview_does_not_contact_geoapify_and_apply_preserves_existing_labels(self):
        result = ('栗田', {'label': '© OpenAddresses contributors', 'url': 'https://openaddresses.io/'})
        output = StringIO()
        target = 'posts.management.commands.backfill_post_places'
        with patch(f'{target}.lookup_post_place', side_effect=[result, None]) as lookup, patch(f'{target}.sleep'):
            call_command('backfill_post_places', stdout=output)
            lookup.assert_not_called()
            self.assertIn('対象 2件（公開中 1件', output.getvalue())
            call_command('backfill_post_places', apply=True, stdout=output)
        self.assertEqual([(int(item.args[0]), int(item.args[1])) for item in lookup.call_args_list], [(36, 138), (37, 139)])
        for post, name in ((self.first, '栗田'), (self.second, ''), (self.saved, '保存済み'), (self.no_coordinates, '')):
            post.refresh_from_db()
            self.assertEqual(post.place_name, name)
        self.assertEqual(self.first.place_attribution, result[1])

    def test_service_failure_stops_the_backfill(self):
        target = 'posts.management.commands.backfill_post_places.lookup_post_place'
        with patch(target, side_effect=PostPlaceServiceError('HTTP 429.')) as lookup:
            with self.assertRaisesMessage(CommandError, 'HTTP 429.'):
                call_command('backfill_post_places', apply=True, stdout=StringIO())
        lookup.assert_called_once()
