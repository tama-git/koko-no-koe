"""旧HTML版のURLに対する利用停止の案内。"""
from django.shortcuts import render


def mobile_html_unavailable(request):
    # POSTでも登録・login/logout処理を呼ばない。CSRF保護は維持する。
    return render(request, 'mobile/unavailable.html', status=410)
