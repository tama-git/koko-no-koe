from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.shortcuts import render, redirect
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET, require_POST, require_http_methods
from ..backends import is_admin_account
from .forms import AdminLoginForm

@never_cache
@require_http_methods(['GET', 'POST'])
def admin_login_view(request):
    if request.method == 'POST':
        form = AdminLoginForm(data=request.POST, request=request)
        if form.is_valid():
            user = form.get_user()
            login(request, user)
            # next は使わず、ログイン後は必ず管理者トップへ移動する。
            return redirect('admin_side:dashboard')
    else:
        # GET時は引数なしで空のフォームを作る
        form = AdminLoginForm()
        
    return render(request, 'admin_side/login.html', {'form': form})

@never_cache
@require_GET
@login_required(login_url='admin_side:login')
def admin_dashboard_view(request):
    """
    管理者用トップ画面
    """
    if not is_admin_account(request.user):
        raise PermissionDenied('管理者アカウントでログインしてください。')
    return render(request, 'admin_side/dashboard.html')


@never_cache
@require_POST
@login_required(login_url='admin_side:login')
def admin_logout_view(request):
    """
    管理者用ログアウト処理
    """
    if not is_admin_account(request.user):
        raise PermissionDenied('管理者アカウントでログインしてください。')
    logout(request)
    return redirect('admin_side:login')
