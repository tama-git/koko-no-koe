import hashlib
import json
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from accounts.models import AdminUser, MobileSession, MobileUser


class MobileApiTests(TestCase):
    def post_json(self, endpoint, data, **headers):
        return self.client.post(f'/api/mobile/{endpoint}/', data=json.dumps(data), content_type='application/json', **headers)

    def test_register_hashes_password_normalizes_email_and_rejects_duplicates(self):
        response = self.post_json('register', {'email': ' User@Example.com ', 'password': 'Abcdef12'})
        self.assertEqual(response.status_code, 201)
        user = MobileUser.objects.get(email='user@example.com')
        self.assertNotEqual(user.password, 'Abcdef12')
        self.assertTrue(user.check_password('Abcdef12'))
        self.assertEqual(self.post_json('register', {'email': 'USER@example.com', 'password': 'Abcdef12'}).status_code, 409)
        self.assertEqual(MobileUser.objects.count(), 1)

    def test_invalid_input_is_rejected_by_server(self):
        for data in ({'email': 'bad', 'password': 'Abcdef12'}, {'email': 'a@example.com', 'password': 'abcdef12'}, {'email': [], 'password': 'Abcdef12'}):
            with self.subTest(data=data):
                self.assertEqual(self.post_json('register', data).status_code, 400)
        self.assertEqual(MobileUser.objects.count(), 0)

    def test_login_logout_token_and_expiry(self):
        self.post_json('register', {'email': 'u@example.com', 'password': 'Abcdef12'})
        self.assertEqual(self.post_json('login', {'email': 'u@example.com', 'password': 'wrong'}).status_code, 401)
        response = self.post_json('login', {'email': 'U@example.com', 'password': 'Abcdef12'})
        self.assertEqual(response.status_code, 200)
        token = response.json()['token']
        self.assertTrue(MobileSession.objects.filter(token_hash=hashlib.sha256(token.encode()).hexdigest()).exists())
        self.assertFalse(MobileSession.objects.filter(token_hash=token).exists())
        auth = {'HTTP_AUTHORIZATION': 'Bearer ' + token}
        self.assertEqual(self.post_json('logout', {}, **auth).status_code, 200)
        self.assertEqual(self.post_json('logout', {}, **auth).status_code, 401)
        token = self.post_json('login', {'email': 'u@example.com', 'password': 'Abcdef12'}).json()['token']
        MobileSession.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.post_json('logout', {}, HTTP_AUTHORIZATION='Bearer ' + token).status_code, 401)

    def test_admin_account_and_session_cannot_authenticate_as_mobile(self):
        AdminUser.objects.create_user(username='admin', email='admin@example.com', password='Admin123')
        self.assertEqual(self.post_json('login', {'email': 'admin@example.com', 'password': 'Admin123'}).status_code, 401)
        self.assertEqual(self.post_json('logout', {}).status_code, 401)
