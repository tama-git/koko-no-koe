import hashlib
import json
from datetime import timedelta
from http.cookiejar import CookieJar
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import HTTPCookieProcessor, ProxyHandler, build_opener

from django.contrib.auth import BACKEND_SESSION_KEY, SESSION_KEY, authenticate, get_user_model
from django.test import Client, LiveServerTestCase, TestCase
from django.urls import reverse
from django.utils import timezone

from accounts.models import AdminUser, MobileSession, MobileUser


ADMIN_BACKEND = 'accounts.backends.AdminEmailBackend'
DEFAULT_BACKEND = 'django.contrib.auth.backends.ModelBackend'


class AdminHttpFlowTests(LiveServerTestCase):
    """一時サーバーへの実HTTP。既存サーバーや実アカウントには接続しない。"""
    def test_http_login_reload_logout_with_csrf(self):
        AdminUser.objects.create_user(username='http-admin', email='http@example.com',
                                      password='HttpAdmin123', is_staff=True)
        cookies = CookieJar()
        browser = build_opener(ProxyHandler({}), HTTPCookieProcessor(cookies))

        def open_page(path, data=None):
            body = None if data is None else urlencode(data).encode()
            with browser.open(self.live_server_url + path, body, timeout=10) as response:
                return response.status, response.url, response.read().decode()

        def csrf_token():
            return next(cookie.value for cookie in cookies if cookie.name == 'csrftoken')

        status, url, _ = open_page('/dashboard/')
        self.assertEqual(status, 200)
        self.assertTrue(url.endswith('/login/?next=/dashboard/'))
        with self.assertRaises(HTTPError) as error:
            open_page('/login/', {'email': 'http@example.com', 'password': 'HttpAdmin123'})
        self.assertEqual(error.exception.code, 403)
        error.exception.close()
        status, url, body = open_page('/login/', {'email': 'http@example.com',
            'password': 'HttpAdmin123', 'csrfmiddlewaretoken': csrf_token()})
        self.assertEqual(status, 200)
        self.assertTrue(url.endswith('/dashboard/'))
        self.assertIn('管理者用の仮ページ', body)
        self.assertEqual(open_page('/dashboard/')[0], 200)
        status, url, _ = open_page('/logout/', {'csrfmiddlewaretoken': csrf_token()})
        self.assertEqual(status, 200)
        self.assertTrue(url.endswith('/login/'))
        self.assertTrue(open_page('/dashboard/')[1].endswith('/login/?next=/dashboard/'))


class AdminAuthenticationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        # 同じID・usernameでも別テーブルのアカウント。パスワードはそれぞれ異なる。
        cls.admin = AdminUser.objects.create_user(pk=17, username='shared-name',
            email='admin@example.com', password='Admin123', is_staff=True)
        cls.regular = get_user_model().objects.create_user(pk=17, username='shared-name',
            email='regular@example.com', password='Regular123')
        cls.mobile = MobileUser.objects.create_user(pk=17, username='shared-name',
            email='mobile@example.com', password='Mobile123')

    def sign_in(self, client=None, **changes):
        data = {'email': 'admin@example.com', 'password': 'Admin123'}
        data.update(changes)
        return (client or self.client).post(reverse('admin_side:login'), data)

    def test_anonymous_dashboard_redirects_to_existing_login(self):
        self.assertEqual(reverse('admin_side:dashboard'), '/dashboard/')
        response = self.client.get('/dashboard/', follow=True)
        self.assertEqual(response.redirect_chain, [('/login/?next=/dashboard/', 302)])
        self.assertTemplateUsed(response, 'admin_side/login.html')
        self.assertEqual(response.status_code, 200)
        self.assertRedirects(self.client.get('/'), '/login/')

    def test_login_dashboard_reload_and_logout(self):
        self.assertRedirects(self.sign_in(), '/dashboard/')
        self.assertEqual(self.client.session[BACKEND_SESSION_KEY], ADMIN_BACKEND)
        self.assertEqual(int(self.client.session[SESSION_KEY]), self.admin.pk)
        for _ in range(2):
            response = self.client.get('/dashboard/')
            self.assertEqual(response.status_code, 200)
            self.assertIsInstance(response.wsgi_request.user, AdminUser)
            self.assertEqual(response.wsgi_request.user.pk, self.admin.pk)
            self.assertTemplateUsed(response, 'admin_side/dashboard.html')
            self.assertContains(response, '管理者用の仮ページ')
            self.assertContains(response, 'action="/logout/"')
            self.assertContains(response, 'csrfmiddlewaretoken')
            self.assertIn('no-store', response.headers['Cache-Control'])
        self.assertRedirects(self.client.post('/logout/'), '/login/')
        self.assertNotIn(SESSION_KEY, self.client.session)
        self.assertRedirects(self.client.get('/dashboard/'), '/login/?next=/dashboard/')

    def test_other_model_credentials_cannot_log_in_as_admin(self):
        for email, password in [('admin@example.com', 'Regular123'), ('admin@example.com', 'Mobile123'),
                                ('regular@example.com', 'Regular123'), ('mobile@example.com', 'Mobile123')]:
            response = self.sign_in(email=email, password=password)
            self.assertContains(response, 'メールアドレスまたはパスワードが正しくありません。')
            self.assertNotIn(SESSION_KEY, self.client.session)
        self.assertRedirects(self.sign_in(), '/dashboard/')

    def test_inactive_or_non_staff_admin_cannot_log_in(self):
        for flags in (
            {'is_active': False, 'is_staff': True, 'is_superuser': False},
            {'is_active': True, 'is_staff': False, 'is_superuser': False},
            {'is_active': True, 'is_staff': False, 'is_superuser': True},
        ):
            with self.subTest(flags=flags):
                AdminUser.objects.filter(pk=self.admin.pk).update(**flags)
                self.assertEqual(self.sign_in().status_code, 200)
                self.assertNotIn(SESSION_KEY, self.client.session)

    def test_regular_and_standard_admin_sessions_are_forbidden(self):
        for staff in (False, True):
            self.regular.is_staff = staff
            self.regular.is_superuser = staff
            self.regular.save()
            self.client.force_login(self.regular, backend=DEFAULT_BACKEND)
            self.assertEqual(self.client.get('/dashboard/').status_code, 403)
            self.assertEqual(self.client.post('/logout/').status_code, 403)
            self.assertEqual(self.client.session[BACKEND_SESSION_KEY], DEFAULT_BACKEND)

    def test_mobile_bearer_token_cannot_open_admin_dashboard(self):
        response = self.client.post('/api/mobile/login/',
            data=json.dumps({'email': 'mobile@example.com', 'password': 'Mobile123'}),
            content_type='application/json')
        token = response.json()['token']
        self.assertRedirects(self.client.get('/dashboard/', HTTP_AUTHORIZATION='Bearer ' + token),
                             '/login/?next=/dashboard/')

    def test_wrong_model_session_cannot_restore_same_id_as_admin(self):
        self.client.force_login(self.mobile, backend=ADMIN_BACKEND)
        self.assertRedirects(self.client.get('/dashboard/'), '/login/?next=/dashboard/')
        self.assertNotIn(SESSION_KEY, self.client.session)

    def test_role_revocation_is_checked_on_next_request(self):
        for field in ('is_staff', 'is_active'):
            AdminUser.objects.filter(pk=self.admin.pk).update(is_staff=True, is_active=True)
            self.assertEqual(self.sign_in().status_code, 302)
            AdminUser.objects.filter(pk=self.admin.pk).update(**{field: False})
            self.assertRedirects(self.client.get('/dashboard/'), '/login/?next=/dashboard/')

    def test_password_change_or_deletion_invalidates_admin_session(self):
        self.sign_in()
        self.admin.set_password('Changed123')
        self.admin.save()
        self.assertRedirects(self.client.get('/dashboard/'), '/login/?next=/dashboard/')
        self.assertEqual(self.sign_in(password='Changed123').status_code, 302)
        self.admin.delete()
        self.assertRedirects(self.client.get('/dashboard/'), '/login/?next=/dashboard/')

    def test_missing_invalid_credentials_and_csrf_do_not_raise_server_errors(self):
        for data in ({}, {'email': 'bad', 'password': 'wrong'}, {'email': 'admin@example.com'},
                     {'email': 'admin@example.com', 'password': 'wrong'}):
            response = self.client.post('/login/', data)
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.context['form'].errors)
            self.assertNotIn(SESSION_KEY, self.client.session)
        client = Client(enforce_csrf_checks=True)
        self.assertEqual(self.sign_in(client).status_code, 403)
        client.get('/login/')
        csrf = client.cookies['csrftoken'].value
        self.assertEqual(self.sign_in(client, csrfmiddlewaretoken=csrf).status_code, 302)
        self.assertEqual(client.post('/logout/').status_code, 403)
        self.assertEqual(client.get('/dashboard/').status_code, 200)
        csrf = client.cookies['csrftoken'].value
        self.assertRedirects(client.post('/logout/', {'csrfmiddlewaretoken': csrf}), '/login/')

    def test_next_never_redirects_outside_dashboard(self):
        for target in ('https://example.org/', '//example.org/', '/admin/'):
            response = self.client.post('/login/?next=' + target,
                {'email': 'admin@example.com', 'password': 'Admin123', 'next': target})
            self.assertRedirects(response, '/dashboard/')

    def test_admin_methods_and_get_logout(self):
        self.sign_in()
        self.assertEqual(self.client.get('/logout/').status_code, 405)
        self.assertEqual(self.client.get('/dashboard/').status_code, 200)
        self.assertEqual(self.client.post('/dashboard/').status_code, 405)
        self.assertEqual(self.client.put('/login/').status_code, 405)

    def test_ambiguous_email_is_rejected_without_selecting_an_account(self):
        AdminUser.objects.create_user(username='duplicate', email='ADMIN@example.com',
                                      password='Admin123', is_staff=True)
        self.assertEqual(self.sign_in().status_code, 200)
        self.assertNotIn(SESSION_KEY, self.client.session)

    def test_email_case_and_password_whitespace(self):
        self.admin.set_password(' Admin123 ')
        self.admin.save()
        self.assertEqual(self.sign_in(email=' ADMIN@example.com ', password='Admin123').status_code, 200)
        self.assertRedirects(self.sign_in(email=' ADMIN@example.com ', password=' Admin123 '), '/dashboard/')

    def test_standard_django_auth_still_uses_auth_user(self):
        user = authenticate(username='shared-name', password='Regular123')
        self.assertIsInstance(user, get_user_model())
        self.assertEqual(user.backend, DEFAULT_BACKEND)
        self.assertIsNone(authenticate(username='shared-name', password='Admin123'))

    def test_admin_cookie_does_not_authorize_mobile_logout(self):
        self.sign_in()
        self.assertEqual(self.client.post('/api/mobile/logout/', '{}', content_type='application/json').status_code, 401)


class DisabledMobileHtmlTests(TestCase):
    def test_all_old_entries_explain_unavailability_without_registering(self):
        client = Client(enforce_csrf_checks=True)
        client.get('/login/')
        csrf = client.cookies['csrftoken'].value
        for name in ('login', 'register', 'index', 'logout'):
            url = reverse('mobile:' + name)
            self.assertContains(client.get(url), 'iPhoneアプリから', status_code=410)
            response = client.post(url, {'email': 'unused@example.com', 'password': 'a',
                'password_confirm': 'a', 'csrfmiddlewaretoken': csrf})
            self.assertContains(response, 'iPhoneアプリから', status_code=410)
        self.assertEqual(MobileUser.objects.count(), 0)
        self.assertNotIn(SESSION_KEY, client.session)

    def test_disabled_entries_do_not_change_an_existing_admin_session(self):
        admin = AdminUser.objects.create_user(username='admin', email='admin@example.com',
                                              password='Admin123', is_staff=True)
        self.client.force_login(admin, backend=ADMIN_BACKEND)
        for name in ('login', 'register', 'index', 'logout'):
            self.assertEqual(self.client.post(reverse('mobile:' + name)).status_code, 410)
            self.assertEqual(self.client.get('/dashboard/').status_code, 200)


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
