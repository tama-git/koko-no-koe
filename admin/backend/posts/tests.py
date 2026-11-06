import hashlib
import io
import tempfile
from datetime import timedelta
from unittest.mock import patch

from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import MobileSession, MobileUser
from .models import Post, PostReport


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
        post_id = self.create(is_published=False, image=self.image()).data['id']
        self.assertFalse(Post.objects.get(pk=post_id).is_public)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer other-token')
        self.assertEqual(self.client.get('/api/posts/').json(), [])
        self.assertEqual(self.client.get('/api/posts/public/').json(), [])
        self.assertEqual(self.client.get(f'/api/posts/{post_id}/').status_code, 404)
        self.assertEqual(self.client.get(f'/api/posts/{post_id}/image/').status_code, 404)

    def test_public_list_and_detail_allow_other_members_without_location(self):
        first = self.create().data['id']
        latest = self.create(latitude='-33.8650000', longitude='151.2094000').data['id']
        unset_id = self.create().data['id']
        Post.objects.filter(pk=unset_id).update(is_public=None)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer other-token')

        self.assertEqual(self.client.get('/api/posts/').json(), [])
        public = self.client.get('/api/posts/public/')
        self.assertEqual(public.status_code, 200)
        self.assertEqual([post['id'] for post in public.json()], [latest, first])
        detail = self.client.get(f'/api/posts/{latest}/')
        self.assertEqual(detail.status_code, 200)
        self.assertNotIn('user_id', detail.json())
        self.assertEqual(self.client.get(f'/api/posts/{unset_id}/').status_code, 404)
        self.assertEqual(self.client.post('/api/posts/public/', self.payload(), format='json').status_code, 405)

    def test_public_photo_for_another_member_does_not_include_camera_metadata(self):
        data = io.BytesIO()
        exif = Image.Exif()
        exif[271] = 'Test camera'
        exif[274] = 6
        Image.new('RGB', (10, 20), 'white').save(data, 'JPEG', exif=exif)
        photo = SimpleUploadedFile('camera.jpg', data.getvalue(), content_type='image/jpeg')
        post_id = self.create(image=photo).data['id']
        photo_url = f'/api/posts/{post_id}/image/'
        self.client.credentials(HTTP_AUTHORIZATION='Bearer other-token')
        response = self.client.get(photo_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'image/jpeg')
        self.assertEqual(response['Cache-Control'], 'private, no-store')
        with Image.open(io.BytesIO(b''.join(response.streaming_content))) as decoded:
            self.assertEqual(decoded.size, (20, 10))
            self.assertFalse(decoded.getexif())
        response.close()

        self.client.credentials()
        for url in ('/api/posts/public/', f'/api/posts/{post_id}/', photo_url):
            self.assertEqual(self.client.get(url).status_code, 401)

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
        self.assertEqual(self.client.patch(f'/api/posts/{post_id}/', {'message': 'changed'}).status_code, 405)

    def test_owner_deletes_post_and_photo_from_all_views(self):
        post_id = self.create(image=self.image()).data['id']
        image = Post.objects.get(pk=post_id).image
        self.assertTrue(image.storage.exists(image.name))
        url = f'/api/posts/{post_id}/'

        response = self.client.delete(url)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(response.content, b'')
        self.assertFalse(Post.objects.filter(pk=post_id).exists())
        self.assertFalse(image.storage.exists(image.name))
        self.assertEqual(self.client.get('/api/posts/').json(), [])
        self.assertEqual(self.client.get('/api/posts/public/').json(), [])
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.get(f'{url}image/').status_code, 404)
        self.assertEqual(self.client.delete(url).status_code, 404)

    def test_public_read_access_does_not_grant_delete_access(self):
        post_id = self.create(image=self.image()).data['id']
        image = Post.objects.get(pk=post_id).image
        url = f'/api/posts/{post_id}/'
        self.client.credentials(HTTP_AUTHORIZATION='Bearer other-token')
        self.assertEqual(self.client.get(url).status_code, 200)
        self.assertEqual(self.client.delete(url).status_code, 404)
        self.client.credentials()
        self.assertEqual(self.client.delete(url).status_code, 401)
        self.assertTrue(Post.objects.filter(pk=post_id).exists())
        self.assertTrue(image.storage.exists(image.name))

    def test_photo_delete_failure_preserves_the_post_for_retry(self):
        post_id = self.create(is_published=False, image=self.image()).data['id']
        image = Post.objects.get(pk=post_id).image
        url = f'/api/posts/{post_id}/'
        with patch.object(image.storage, 'delete', side_effect=PermissionError('locked')):
            self.assertEqual(self.client.delete(url).status_code, 503)
        self.assertTrue(Post.objects.filter(pk=post_id).exists())
        self.assertTrue(image.storage.exists(image.name))
        self.assertEqual(self.client.delete(url).status_code, 204)
        self.assertFalse(image.storage.exists(image.name))

    def test_legacy_posts_can_be_deleted_without_removing_a_shared_photo(self):
        shared = self.create(image=self.image()).data['id']
        image = Post.objects.get(pk=shared).image
        legacy = Post.objects.create(user_id=self.owner, message='以前の投稿', image=image.name)
        text_only = Post.objects.create(user_id=self.owner, message='本文のみ')
        self.assertEqual(self.client.delete(f'/api/posts/{legacy.pk}/').status_code, 204)
        self.assertEqual(self.client.delete(f'/api/posts/{text_only.pk}/').status_code, 204)
        self.assertEqual(list(Post.objects.values_list('pk', flat=True)), [shared])
        self.assertTrue(image.storage.exists(image.name))

    def test_report_uses_the_logged_in_member_and_resets_status_only_on_new_report(self):
        post_id = self.create().data['id']
        url = f'/api/posts/{post_id}/reports/'
        self.client.credentials(HTTP_AUTHORIZATION='Bearer other-token')
        response = self.client.post(url, {'category': 'spam', 'reporter': self.owner.pk}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json(), {'status': 'received'})
        self.assertEqual(PostReport.objects.get().reporter, self.other)
        self.assertEqual(PostReport.objects.get().details, '')
        self.assertEqual(Post.objects.get(pk=post_id).report_status, Post.ReportStatus.PENDING)

        Post.objects.filter(pk=post_id).update(report_status=Post.ReportStatus.RESOLVED)
        self.assertEqual(self.client.post(url, {'category': 'spam'}, format='json').status_code, 409)
        self.assertEqual(Post.objects.get(pk=post_id).report_status, Post.ReportStatus.RESOLVED)
        self.assertEqual(PostReport.objects.count(), 1)

        third_member = MobileUser.objects.create_user(username='third', email='third@example.com', password='Third123')
        MobileSession.objects.create(user=third_member, token_hash=hashlib.sha256(b'third-token').hexdigest(),
                                     expires_at=timezone.now() + timedelta(hours=1))
        self.client.credentials(HTTP_AUTHORIZATION='Bearer third-token')
        self.assertEqual(self.client.post(url, {'category': 'other', 'details': '補足'}, format='json').status_code, 201)
        self.assertEqual(Post.objects.get(pk=post_id).report_status, Post.ReportStatus.PENDING)
        self.assertEqual(PostReport.objects.count(), 2)

    def test_report_categories_required_details_and_length_are_validated(self):
        post_id = self.create().data['id']
        url = f'/api/posts/{post_id}/reports/'
        self.client.credentials(HTTP_AUTHORIZATION='Bearer other-token')
        for payload in ({}, {'category': 'unknown'}, {'category': 'other'},
                        {'category': 'other', 'details': ' \t '}, {'category': 'spam', 'details': 'あ' * 101}):
            with self.subTest(payload=payload):
                self.assertEqual(self.client.post(url, payload, format='json').status_code, 400)
        self.assertFalse(PostReport.objects.exists())
        self.assertIsNone(Post.objects.get(pk=post_id).report_status)
        self.assertEqual(self.client.post(url, {'category': 'other', 'details': 'あ' * 100}, format='json').status_code, 201)

    def test_reports_can_only_be_sent_for_another_members_public_post(self):
        public = self.create().data['id']
        private = self.create(is_published=False).data['id']
        data = {'category': 'privacy'}
        self.assertFalse(self.client.get(f'/api/posts/{public}/').json()['can_report'])
        self.assertEqual(self.client.post(f'/api/posts/{public}/reports/', data, format='json').status_code, 404)
        self.client.credentials()
        self.assertEqual(self.client.post(f'/api/posts/{public}/reports/', data, format='json').status_code, 401)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer other-token')
        self.assertTrue(self.client.get(f'/api/posts/{public}/').json()['can_report'])
        self.assertEqual(self.client.post(f'/api/posts/{private}/reports/', data, format='json').status_code, 404)
        self.assertEqual(self.client.get(f'/api/posts/{public}/reports/').status_code, 405)
        self.assertFalse(PostReport.objects.exists())

    def test_deleting_a_post_removes_its_reports(self):
        post_id = self.create().data['id']
        PostReport.objects.create(post_id=post_id, reporter=self.other, category=PostReport.Category.SPAM)
        self.assertEqual(self.client.delete(f'/api/posts/{post_id}/').status_code, 204)
        self.assertFalse(PostReport.objects.exists())

    def test_admin_hidden_post_is_visible_only_to_its_author_in_mobile_apis(self):
        post_id = self.create(image=self.image()).data['id']
        Post.objects.filter(pk=post_id).update(admin_hidden_at=timezone.now())
        detail = f'/api/posts/{post_id}/'
        photo = f'{detail}image/'
        own_post = self.client.get(detail).json()
        self.assertTrue(own_post['is_admin_hidden'])
        self.assertFalse(own_post['can_report'])
        self.assertEqual(self.client.get('/api/posts/').json()[0]['id'], post_id)
        owner_photo = self.client.get(photo)
        self.assertEqual(owner_photo.status_code, 200)
        owner_photo.close()
        self.assertEqual(self.client.get('/api/posts/public/').json(), [])

        self.client.credentials(HTTP_AUTHORIZATION='Bearer other-token')
        self.assertEqual(self.client.get('/api/posts/public/').json(), [])
        self.assertEqual(self.client.get(detail).status_code, 404)
        self.assertEqual(self.client.get(photo).status_code, 404)
        self.assertEqual(self.client.post(f'{detail}reports/', {'category': 'spam'}, format='json').status_code, 404)

    def test_author_can_toggle_visibility_and_photo_access_follows_it(self):
        post_id = self.create(is_published=False, image=self.image()).data['id']
        detail = f'/api/posts/{post_id}/'
        visibility = f'{detail}visibility/'
        other_client = APIClient()
        other_client.credentials(HTTP_AUTHORIZATION='Bearer other-token')
        self.assertEqual(other_client.get(detail).status_code, 404)

        response = self.client.patch(visibility, {'is_published': True}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'is_published': True})
        self.assertEqual([post['id'] for post in other_client.get('/api/posts/public/').json()], [post_id])
        self.assertEqual(other_client.get(detail).status_code, 200)
        photo = other_client.get(f'{detail}image/')
        self.assertEqual(photo.status_code, 200)
        photo.close()

        self.assertEqual(self.client.patch(visibility, {'is_published': False}, format='json').status_code, 200)
        self.assertFalse(self.client.get(detail).json()['is_published'])
        self.assertEqual(other_client.get('/api/posts/public/').json(), [])
        self.assertEqual(other_client.get(detail).status_code, 404)
        self.assertEqual(other_client.get(f'{detail}image/').status_code, 404)

    def test_visibility_update_requires_a_valid_choice_and_the_unmoderated_owner(self):
        post_id = self.create().data['id']
        url = f'/api/posts/{post_id}/visibility/'
        for body in ({}, {'is_published': None}, {'is_published': 'false'},
                     {'is_published': False, 'message': 'changed'}):
            self.assertEqual(self.client.patch(url, body, format='json').status_code, 400)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer other-token')
        self.assertEqual(self.client.patch(url, {'is_published': False}, format='json').status_code, 404)
        self.assertTrue(Post.objects.get(pk=post_id).is_public)
        self.client.credentials()
        self.assertEqual(self.client.patch(url, {'is_published': False}, format='json').status_code, 401)

        Post.objects.filter(pk=post_id).update(admin_hidden_at=timezone.now(), is_public=False)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer writer-token')
        self.assertEqual(self.client.patch(url, {'is_published': True}, format='json').status_code, 403)
        self.assertFalse(Post.objects.get(pk=post_id).is_public)
