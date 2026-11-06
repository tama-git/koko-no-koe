import io
import tempfile
from contextlib import closing

from PIL import Image
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from posts.models import Post, PostReport
from .models import AdminUser, MobileUser


class AdminConsoleTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = AdminUser.objects.create_user(username='moderator', email='moderator@example.test', is_staff=True)
        author = MobileUser.objects.create_user(username='author', email='author@example.test')
        cls.reporter = MobileUser.objects.create_user(username='reporter', email='reporter@example.test')
        another = MobileUser.objects.create_user(username='another', email='another@example.test')
        cls.pending = Post.objects.create(user_id=author, message='通報対象の公開投稿', is_public=True)
        cls.reviewed = Post.objects.create(
            user_id=author, message='閲覧済みの公開投稿', is_public=True, report_status=Post.ReportStatus.REVIEWED,
        )
        cls.private = Post.objects.create(user_id=author, message='本人だけの本文', is_public=False)
        PostReport.objects.bulk_create([
            PostReport(post=cls.pending, reporter=cls.reporter, category=PostReport.Category.SPAM, details='理由の補足'),
            PostReport(post=cls.pending, reporter=another, category=PostReport.Category.OTHER, details='<script>test</script>'),
            PostReport(post=cls.reviewed, reporter=another, category=PostReport.Category.PRIVACY),
        ])

    def sign_in(self):
        self.client.force_login(self.admin, backend='accounts.backends.AdminEmailBackend')

    def test_dashboard_groups_reports_and_filters_without_changing_post_list(self):
        self.sign_in()
        response = self.client.get(reverse('admin_side:dashboard'), {'status': 'pending'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['reported_count'], 2)
        self.assertEqual(response.context['pending_count'], 1)
        self.assertEqual([(post.pk, post.report_count) for post in response.context['report_page']], [(self.pending.pk, 2)])
        self.assertEqual([post.pk for post in response.context['post_page']], [self.private.pk, self.reviewed.pk, self.pending.pk])
        self.assertContains(response, '本人のみ公開の投稿')
        self.assertNotContains(response, self.private.message)
        self.assertIsNone(Post.objects.get(pk=self.pending.pk).report_status)

    def test_detail_shows_each_report_and_preserves_filter_on_back_link(self):
        self.sign_in()
        url = reverse('admin_side:post-detail', args=[self.pending.pk])
        response = self.client.get(url, {'source': 'reports', 'status': 'pending'})
        self.assertContains(response, self.pending.message)
        self.assertContains(response, '迷惑行為・スパム')
        self.assertContains(response, '理由の補足')
        self.assertContains(response, '&lt;script&gt;test&lt;/script&gt;')
        self.assertNotContains(response, '<script>test</script>')
        self.assertContains(response, '会員 #' + str(self.reporter.pk))
        self.assertNotContains(response, self.reporter.email)
        self.assertContains(response, '/dashboard/?status=pending#reports')
        self.assertIn('no-store', response['Cache-Control'])

        private = self.client.get(reverse('admin_side:post-detail', args=[self.private.pk]))
        self.assertContains(private, '本人のみ公開')
        self.assertNotContains(private, self.private.message)

    def test_dashboard_paginates_posts_with_the_report_filter_preserved(self):
        self.sign_in()
        Post.objects.bulk_create([
            Post(user_id=self.reporter, message=f'追加投稿 {index}', is_public=True)
            for index in range(20)
        ])
        response = self.client.get(reverse('admin_side:dashboard'), {'status': 'reviewed'})
        self.assertEqual(len(response.context['post_page']), 20)
        self.assertContains(response, '?status=reviewed&amp;post_page=2#posts')
        second = self.client.get(reverse('admin_side:dashboard'), {'status': 'reviewed', 'post_page': '2'})
        self.assertEqual(len(second.context['post_page']), 3)
        self.assertEqual([post.pk for post in second.context['report_page']], [self.reviewed.pk])

    def test_admin_session_is_required_for_details_and_photos(self):
        detail = reverse('admin_side:post-detail', args=[self.pending.pk])
        photo_url = reverse('admin_side:post-photo', args=[self.pending.pk])
        for url in (detail, photo_url):
            self.assertRedirects(self.client.get(url), f'/login/?next={url}')

        staff = get_user_model().objects.create_user(username='standard-staff', is_staff=True)
        self.client.force_login(staff, backend='django.contrib.auth.backends.ModelBackend')
        for url in (detail, photo_url):
            self.assertEqual(self.client.get(url).status_code, 403)

        self.sign_in()
        with tempfile.TemporaryDirectory() as media, override_settings(MEDIA_ROOT=media):
            photo = io.BytesIO()
            Image.new('RGB', (5, 5), 'white').save(photo, 'PNG')
            self.pending.image.save('test.png', SimpleUploadedFile('test.png', photo.getvalue()))
            self.private.image = self.pending.image.name
            self.private.save(update_fields=['image'])
            with closing(self.client.get(photo_url)) as response:
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response['Content-Type'], 'image/jpeg')
                self.assertIn('no-store', response['Cache-Control'])
                self.assertTrue(b''.join(response.streaming_content).startswith(b'\xff\xd8'))
            self.assertEqual(self.client.get(reverse('admin_side:post-photo', args=[self.private.pk])).status_code, 404)
            Post.objects.filter(pk=self.pending.pk).update(admin_hidden_at=timezone.now(), is_public=False)
            with closing(self.client.get(photo_url)) as response:
                self.assertEqual(response.status_code, 200)

    def test_admin_hide_requires_post_and_csrf_and_keeps_the_detail_available(self):
        self.client = Client(enforce_csrf_checks=True)
        self.sign_in()
        detail = reverse('admin_side:post-detail', args=[self.pending.pk])
        review = reverse('admin_side:post-review', args=[self.pending.pk])
        response = self.client.get(detail)
        self.assertContains(response, '管理者として非表示にする')
        data = {'action': 'hide', 'expected_state': 'pending', 'report_id': response.context['report_id']}
        self.assertEqual(self.client.get(review).status_code, 405)
        self.assertEqual(self.client.post(review, data).status_code, 403)
        self.assertFalse(Post.objects.get(pk=self.pending.pk).is_admin_hidden)

        data['csrfmiddlewaretoken'] = self.client.cookies['csrftoken'].value
        self.assertRedirects(self.client.post(review, data), detail)
        hidden = Post.objects.get(pk=self.pending.pk)
        self.assertTrue(hidden.is_admin_hidden and hidden.is_public)
        self.assertEqual(hidden.admin_hidden_by, self.admin)
        self.assertEqual(hidden.report_status, Post.ReportStatus.RESOLVED)
        self.assertEqual(hidden.reports.count(), 2)
        response = self.client.get(detail)
        self.assertContains(response, self.pending.message)
        self.assertContains(response, '管理者により非表示')
        self.assertNotContains(response, '非表示を確定')

        data.update(action='pending', expected_state='resolved')
        self.assertRedirects(self.client.post(review, data), detail)
        hidden.refresh_from_db()
        self.assertTrue(hidden.is_admin_hidden)
        self.assertEqual(hidden.report_status, Post.ReportStatus.PENDING)

    def test_review_cannot_overwrite_a_report_added_after_opening_detail(self):
        self.sign_in()
        detail = reverse('admin_side:post-detail', args=[self.pending.pk])
        review = reverse('admin_side:post-review', args=[self.pending.pk])
        report_id = self.client.get(detail).context['report_id']
        new_reporter = MobileUser.objects.create_user(username='later-reporter', email='later@example.test')
        PostReport.objects.create(post=self.pending, reporter=new_reporter, category=PostReport.Category.PRIVACY)
        result = self.client.post(review, {'action': 'hide', 'expected_state': 'pending', 'report_id': report_id}, follow=True)
        self.assertContains(result, '最新の内容を確認してください')
        self.assertFalse(Post.objects.get(pk=self.pending.pk).is_admin_hidden)

        fresh_id = self.client.get(detail).context['report_id']
        self.assertRedirects(self.client.post(review, {'action': 'resolved', 'expected_state': 'pending', 'report_id': fresh_id}), detail)
        self.pending.refresh_from_db()
        self.assertEqual(self.pending.report_status, Post.ReportStatus.RESOLVED)
        self.assertFalse(self.pending.is_admin_hidden)
