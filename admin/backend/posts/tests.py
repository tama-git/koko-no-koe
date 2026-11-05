import hashlib
import io
import tempfile
from datetime import timedelta

from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import MobileSession, MobileUser
from .models import Post


class PostApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = MobileUser.objects.create_user(username='writer', email='writer@example.com', password='Writer123')
        cls.other = MobileUser.objects.create_user(username='other', email='other@example.com', password='Other123')
        for user, token in [(cls.owner, 'writer-token'), (cls.other, 'other-token')]:
            MobileSession.objects.create(user=user, token_hash=hashlib.sha256(token.encode()).hexdigest(),
                                         expires_at=timezone.now() + timedelta(hours=1))

    def setUp(self):
        self.media = tempfile.TemporaryDirectory()
        self.override = override_settings(MEDIA_ROOT=self.media.name)
        self.override.enable()
        self.addCleanup(self.media.cleanup)
        self.addCleanup(self.override.disable)
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer writer-token')

    def payload(self, **changes):
        data = {'message': '保存する投稿', 'latitude': '35.1234567', 'longitude': '139.1234567', 'is_published': True}
        data.update(changes)
        return data

    def create(self, **changes):
        return self.client.post('/api/posts/', self.payload(**changes), format='multipart')

    def image(self):
        data = io.BytesIO()
        Image.new('RGB', (10, 10), 'white').save(data, 'PNG')
        return SimpleUploadedFile('camera.png', data.getvalue(), content_type='image/png')

    def test_create_and_read_own_post_with_server_assigned_owner(self):
        response = self.create(user_id=self.other.pk)
        self.assertEqual(response.status_code, 201, response.data)
        post = Post.objects.get()
        self.assertEqual(post.user_id, self.owner)
        self.assertTrue(post.is_public)
        self.assertNotIn('user_id', response.data)
        self.assertIsInstance(response.json()['latitude'], float)
        self.assertEqual(self.client.get('/api/posts/').json()[0]['id'], post.pk)
        detail = self.client.get(f'/api/posts/{post.pk}/')
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()['message'], '保存する投稿')

    def test_non_public_post_and_other_accounts_are_not_exposed(self):
        post_id = self.create(is_published=False).data['id']
        self.assertFalse(Post.objects.get(pk=post_id).is_public)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer other-token')
        self.assertEqual(self.client.get('/api/posts/').json(), [])
        self.assertEqual(self.client.get(f'/api/posts/{post_id}/').status_code, 404)
        self.assertEqual(self.client.get(f'/api/posts/{post_id}/image/').status_code, 404)

    def test_photo_only_post_upload_and_protected_download(self):
        response = self.create(message='', image=self.image())
        self.assertEqual(response.status_code, 201, response.data)
        post = Post.objects.get()
        self.assertTrue(post.image.name.startswith('posts/'))
        self.assertNotIn('camera', post.image.name)
        self.assertEqual(response.data['image'], f'http://testserver/api/posts/{post.pk}/image/')
        image = self.client.get(f'/api/posts/{post.pk}/image/')
        self.assertEqual(image.status_code, 200)
        self.assertTrue(b''.join(image.streaming_content).startswith(b'\x89PNG'))
        image.close()
        self.client.credentials()
        self.assertEqual(self.client.get(f'/api/posts/{post.pk}/image/').status_code, 401)

    def test_missing_invalid_and_deleted_tokens_are_rejected(self):
        for header in ('', 'Bearer unknown', 'Basic abc', 'Bearer'):
            self.client.credentials(HTTP_AUTHORIZATION=header)
            self.assertEqual(self.client.get('/api/posts/').status_code, 401)
            self.assertEqual(self.create().status_code, 401)
        MobileSession.objects.filter(user=self.owner).delete()
        self.client.credentials(HTTP_AUTHORIZATION='Bearer writer-token')
        self.assertEqual(self.create().status_code, 401)

    def test_expired_inactive_and_deleted_users_are_rejected(self):
        MobileSession.objects.filter(user=self.owner).update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.create().status_code, 401)
        MobileSession.objects.filter(user=self.owner).update(expires_at=timezone.now() + timedelta(hours=1))
        MobileUser.objects.filter(pk=self.owner.pk).update(is_active=False)
        self.assertEqual(self.create().status_code, 401)
        self.owner.delete()
        self.assertEqual(self.create().status_code, 401)

    def test_empty_input_coordinates_and_broken_images_are_rejected(self):
        for changes in ({'message': '  '}, {'latitude': ''}, {'longitude': '181'}, {'latitude': '91'},
                        {'latitude': 'NaN'}, {'longitude': 'Infinity'}, {'is_published': 'unknown'}):
            with self.subTest(changes=changes):
                self.assertEqual(self.create(**changes).status_code, 400)
        invalid = SimpleUploadedFile('fake.png', b'not an image', content_type='image/png')
        self.assertEqual(self.create(image=invalid).status_code, 400)
        self.assertEqual(Post.objects.count(), 0)

    def test_missing_coordinates_are_required_even_though_old_model_allows_null(self):
        data = self.payload()
        del data['latitude']
        self.assertEqual(self.client.post('/api/posts/', data, format='json').status_code, 400)

    def test_multiple_images_are_rejected(self):
        self.assertEqual(self.create(image=[self.image(), self.image()]).status_code, 400)
        self.assertEqual(Post.objects.count(), 0)

    def test_cookie_login_cannot_replace_mobile_bearer_auth(self):
        from django.contrib.auth import get_user_model
        user = get_user_model().objects.create_user(username='staff', password='Staff123', is_staff=True)
        self.client.credentials()
        self.client.force_login(user, backend='django.contrib.auth.backends.ModelBackend')
        self.assertEqual(self.create().status_code, 401)

    def test_no_image_and_unsupported_modifications(self):
        post_id = self.create().data['id']
        self.assertEqual(self.client.get(f'/api/posts/{post_id}/image/').status_code, 404)
        self.assertEqual(self.client.delete(f'/api/posts/{post_id}/').status_code, 405)
        self.assertEqual(self.client.patch(f'/api/posts/{post_id}/', {'message': 'changed'}).status_code, 405)
