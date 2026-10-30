from django import forms
from django.contrib.auth import authenticate
from ..models import AdminUser

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
        widget=forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': 'パスワードを入力'})
    )

    def clean(self):
        cleaned_data = super().clean()
        email = cleaned_data.get('email')
        password = cleaned_data.get('password')

        if email and password:
            try:
                user_obj = AdminUser.objects.get(email=email)
                user = authenticate(username=user_obj.username, password=password)
            except AdminUser.DoesNotExist:
                user = None

            if user is None:
                raise forms.ValidationError("メールアドレスまたはパスワードが正しくありません。")
            
            self.user_cache = user
        return cleaned_data

    def get_user(self):
        return getattr(self, 'user_cache', None)