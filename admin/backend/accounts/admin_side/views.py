from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect
from .forms import AdminLoginForm

def admin_login_view(request):
    if request.method == 'POST':
        form = AdminLoginForm(data=request.POST)
        if form.is_valid():
            user = form.get_user()
            login(request, user)
            return redirect('admin_side:index')
    else:
        # GET時は引数なしで空のフォームを作る
        form = AdminLoginForm()
        
    return render(request, 'admin_side/login.html', {'form': form})

@login_required
def admin_dashboard_view(request):
    """
    管理者用トップ画面
    """
    return render(request, 'admin_previe/dashboard.html')


def admin_logout_view(request):
    """
    管理者用ログアウト処理
    """
    logout(request)
    return redirect('admin_side:login')