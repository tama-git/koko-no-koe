"""旧サンプルの処理だけを検証。現行画面の描画・認証はaccounts.testsで検証する。"""
from unittest.mock import patch

from django.http import Http404
from django.test import RequestFactory, SimpleTestCase
from django.urls import NoReverseMatch, reverse

from . import views


class AdminPreviewTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def dashboard_context(self, query=None):
        # 旧テンプレートは現行画面では使わない。描画を差し替え、データ選択を検証する。
        with patch('preview.views.render') as render:
            views.dashboard(self.factory.get('/', query or {}))
        return render.call_args.args[2]

    def test_sample_counts_and_preview_is_not_public(self):
        context = self.dashboard_context()
        self.assertEqual(len(context['reports']), 3)
        self.assertEqual(context['total_count'], 3)
        self.assertEqual(context['pending_count'], 2)
        self.assertEqual(context['reviewed_count'], 1)
        with self.assertRaises(NoReverseMatch):
            reverse('preview:dashboard')

    def test_filter_selects_sample_status_and_invalid_value_falls_back(self):
        for value, expected in [("pending", 2), ("reviewed", 1), ("unknown", 3)]:
            with self.subTest(value=value):
                context = self.dashboard_context({'status': value})
                self.assertEqual(len(context['reports']), expected)
                self.assertEqual(context['active_filter'], 'all' if value == 'unknown' else value)

    def test_detail_and_unknown_report(self):
        request = self.factory.get('/')
        with patch('preview.views.render') as render:
            views.report_detail(request, 1)
        report = render.call_args.args[2]['report']
        self.assertEqual(report['id'], 1)
        self.assertEqual(report['post_title'], '川沿いで見つけた、小さな春')
        with self.assertRaises(Http404):
            views.report_detail(request, 999)

    def test_preview_does_not_accept_writes(self):
        request = self.factory.post('/')
        self.assertEqual(views.dashboard(request).status_code, 405)
        self.assertEqual(views.report_detail(request, 1).status_code, 405)
