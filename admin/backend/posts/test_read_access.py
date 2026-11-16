import math

from django.contrib.auth.models import AnonymousUser
from django.test import TestCase
from django.utils import timezone

from accounts.models import AdminUser, MobileUser
from likes.models import PostReaction

from .models import HiddenPost, Post
from .nearby import EARTH_RADIUS_METERS
from .read_access import readable_posts


class ReadablePostsTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = MobileUser.objects.create(username='writer', email='writer@example.com')
        cls.viewer = MobileUser.objects.create(username='reader', email='reader@example.com')
        cls.post = Post.objects.create(user_id=cls.owner, is_public=True, latitude=0, longitude=0)

    def can_read(self, post=None, viewer=None, coordinates=(0, 0)):
        post = self.post if post is None else post
        viewer = self.viewer if viewer is None else viewer
        return readable_posts(Post.objects.filter(pk=post.pk), viewer, coordinates).exists()

    def test_owner_can_read_private_and_admin_hidden_posts_with_no_coordinates(self):
        for state in (
            {'is_public': False},
            {'is_public': True, 'admin_hidden_at': timezone.now()},
        ):
            with self.subTest(state=state):
                own = Post.objects.create(user_id=self.viewer, **state)
                self.assertTrue(self.can_read(own, coordinates=None))
                self.assertTrue(self.can_read(own, coordinates=(90, 180)))

    def test_other_members_can_read_up_to_and_including_250_meters(self):
        for meters, expected in ((249.99, True), (250, True), (250.01, False)):
            with self.subTest(meters=meters):
                coordinates = (math.degrees(meters / EARTH_RADIUS_METERS), 0)
                self.assertEqual(self.can_read(coordinates=coordinates), expected)

    def test_private_unset_and_admin_hidden_posts_are_excluded(self):
        for state in (
            {'is_public': False},
            {'is_public': None},
            {'is_public': True, 'admin_hidden_at': timezone.now()},
        ):
            with self.subTest(state=state):
                post = Post.objects.create(user_id=self.owner, latitude=0, longitude=0, **state)
                self.assertFalse(self.can_read(post))

    def test_personal_hide_only_applies_to_the_viewer_who_hid_the_post(self):
        HiddenPost.objects.create(user_id=self.viewer, post_id=self.post)
        other = MobileUser.objects.create(username='third', email='third@example.com')
        self.assertFalse(self.can_read())
        self.assertTrue(self.can_read(viewer=other))

    def test_missing_and_invalid_viewer_coordinates_deny_other_posts(self):
        for coordinates in (None, (None, 0), (0,), (0, 0, 0), (91, 0), (0, -181),
                            (float('nan'), 0), (0, float('inf')), ('invalid', 0), (True, 0)):
            with self.subTest(coordinates=coordinates):
                self.assertFalse(self.can_read(coordinates=coordinates))
                self.assertTrue(self.can_read(viewer=self.owner, coordinates=coordinates))

    def test_missing_and_invalid_saved_coordinates_deny_other_posts(self):
        for latitude, longitude in ((None, 0), (0, None), (91, 0), (0, 181)):
            with self.subTest(latitude=latitude, longitude=longitude):
                post = Post.objects.create(
                    user_id=self.owner, is_public=True, latitude=latitude, longitude=longitude,
                )
                self.assertFalse(self.can_read(post))
                self.assertTrue(self.can_read(post, viewer=self.owner, coordinates=None))

    def test_out_of_range_saved_latitude_near_pole_is_rejected(self):
        post = Post.objects.create(user_id=self.owner, is_public=True, latitude=90.0001, longitude=0)
        self.assertFalse(self.can_read(post, coordinates=(90, 0)))

    def test_reacted_post_still_requires_distance_check(self):
        PostReaction.objects.create(post=self.post, user=self.viewer, emoji='👍')
        self.assertTrue(self.can_read())
        self.assertFalse(self.can_read(coordinates=(1, 0)))

    def test_list_returns_owned_and_readable_posts_in_requested_order(self):
        own = Post.objects.create(user_id=self.viewer, is_public=False)
        Post.objects.create(user_id=self.owner, is_public=True, latitude=1, longitude=0)
        queryset = Post.objects.order_by('-pk')
        self.assertEqual(list(readable_posts(queryset, self.viewer, (0, 0))), [own, self.post])
        self.assertEqual(list(readable_posts(queryset, self.viewer)), [own])

    def test_non_mobile_or_inactive_viewer_is_denied(self):
        admin = AdminUser.objects.create(pk=self.owner.pk, username='admin', email='admin@example.com')
        self.viewer.is_active = False
        for viewer in (AnonymousUser(), admin, self.viewer):
            with self.subTest(viewer=viewer):
                self.assertFalse(self.can_read(viewer=viewer))
