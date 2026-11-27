from django import forms
from django.contrib.auth import authenticate

from posts.models import Post
from ..backends import is_admin_account

class AdminLoginForm(forms.Form):
    """
    管理者ログイン用フォーム（メールアドレスを使用）
    """
    email = forms.EmailField(
        label="メールアドレス",
        widget=forms.EmailInput(attrs={'class': 'form-control', 'placeholder': '管理者メールアドレスを入力'})
    )
    password = forms.CharField(
        label="パスワード",
        strip=False,
        widget=forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': 'パスワードを入力'})
    )

    def __init__(self, *args, request=None, **kwargs):
        # 認証に使うリクエストと、認証結果を保持する欄を用意する。
        super().__init__(*args, **kwargs)
        self.request = request
        self.user_cache = None

    def clean(self):
        # 入力されたメールアドレスとパスワードで、利用可能な管理者アカウントかを確認する。
        cleaned_data = super().clean()
        email = cleaned_data.get('email')
        password = cleaned_data.get('password')

        if email and password:
            user = authenticate(self.request, admin_email=email, password=password)
            if not is_admin_account(user):
                raise forms.ValidationError("メールアドレスまたはパスワードが正しくありません。")
            
            self.user_cache = user
        return cleaned_data

    def get_user(self):
        # フォームの検証に成功した管理者をログイン処理へ渡す。
        return getattr(self, 'user_cache', None)


class PostReviewForm(forms.Form):
    action = forms.ChoiceField(choices=[*Post.ReportStatus.choices, ('hide', '管理者非表示')])
    expected_state = forms.ChoiceField(choices=Post.ReportStatus.choices)
    report_id = forms.IntegerField(min_value=1, max_value=2**63 - 1)
