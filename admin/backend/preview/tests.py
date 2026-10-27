from django.test import SimpleTestCase
from django.urls import reverse


class AdminPreviewTests(SimpleTestCase):
    def test_dashboard_renders_external_frontend_templates(self):
        response = self.client.get(reverse("preview:dashboard"))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "admin_preview/dashboard.html")
        self.assertContains(response, "管理者用の仮ページ")
        self.assertEqual(len(response.context["reports"]), 3)

    def test_filter_selects_sample_status_and_invalid_value_falls_back(self):
        for value, expected in [("pending", 2), ("reviewed", 1), ("unknown", 3)]:
            with self.subTest(value=value):
                response = self.client.get(reverse("preview:dashboard"), {"status": value})
                self.assertEqual(len(response.context["reports"]), expected)

    def test_detail_and_unknown_report(self):
        response = self.client.get(reverse("preview:report-detail", args=[1]))
        self.assertContains(response, "川沿いで見つけた、小さな春")
        self.assertContains(response, "disabled")
        self.assertEqual(self.client.get(reverse("preview:report-detail", args=[999])).status_code, 404)

    def test_preview_does_not_accept_writes(self):
        self.assertEqual(self.client.post(reverse("preview:dashboard")).status_code, 405)
        self.assertEqual(self.client.post(reverse("preview:report-detail", args=[1])).status_code, 405)
