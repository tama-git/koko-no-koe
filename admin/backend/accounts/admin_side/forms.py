from django import forms
from django.contrib.auth import authenticate
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
        super().__init__(*args, **kwargs)
        self.request = request
        self.user_cache = None

    def clean(self):
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
        return getattr(self, 'user_cache', None)
