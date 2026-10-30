from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect
from django.contrib import messages
from ..models import MobileUser
from .forms import MobileLoginForm, MobileRegistrationForm

def mobile_login_view(request):
    """
    会員用ログイン画面のビュー
    """
    if request.method == 'POST':
        form = MobileLoginForm(request, data=request.POST)
        if form.is_valid():
            user = form.get_user()
            if isinstance(user, MobileUser):
                login(request, user)
                return redirect('mobile:dashboard')
            else:
                messages.error(request, '会員アカウントではありません。')
        else:
            messages.error(request, 'メールアドレスまたはパスワードが正しくありません。')
    else:
        form = MobileLoginForm()
        
    return render(request, 'mobile/login.html', {'form': form})


def mobile_register_view(request):
    """
    会員用新規登録画面のビュー
    """
    if request.method == 'POST':
        form = MobileRegistrationForm(request.POST)
        if form.is_valid():
            # ユーザーを保存（パスワードもハッシュ化される）
            user = form.save()
            # 登録完了と同時に自動でログインさせる
            login(request, user)
            messages.success(request, '会員登録が完了しました！')
            return redirect('mobile:dashboard')
        else:
            messages.error(request, '入力内容にエラーがあります。')
    else:
        form = MobileRegistrationForm()

    return render(request, 'mobile/register.html', {'form': form})


@login_required
def mobile_index_view(request):
    """
    会員用トップ画面のビュー
    """
    if not isinstance(request.user, MobileUser):
        logout(request)
        return redirect('mobile:login')
        
    context = {'user': request.user}
    return render(request, 'mobile/dashboard.html', context)


def mobile_logout_view(request):
    """
    会員のログアウト処理ビュー
    """
    logout(request)
    return redirect('mobile:login')