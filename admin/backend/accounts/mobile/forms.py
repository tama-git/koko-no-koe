from django import forms
from django.contrib.auth import authenticate
from ..models import MobileUser

class MobileLoginForm(forms.Form):
    """
    会員ログイン用フォーム（メールアドレスを使用）
    """
    email = forms.EmailField(
        label="メールアドレス",
        widget=forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'メールアドレスを入力'})
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
                user_obj = MobileUser.objects.get(email=email)
                user = authenticate(username=user_obj.username, password=password)
            except MobileUser.DoesNotExist:
                user = None

            if user is None:
                raise forms.ValidationError("メールアドレスまたはパスワードが正しくありません。")
            
            self.user_cache = user
        return cleaned_data

    def get_user(self):
        return getattr(self, 'user_cache', None)


class MobileRegistrationForm(forms.ModelForm):
    """
    会員用新規登録フォーム（メールアドレスを使用）
    """
    password = forms.CharField(
        label="パスワード",
        widget=forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': 'パスワードを入力'})
    )
    password_confirm = forms.CharField(
        label="パスワード（確認）",
        widget=forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': 'もう一度パスワードを入力'})
    )

    class Meta:
        model = MobileUser
        fields = ['email', 'first_name', 'last_name']
        widgets = {
            'email': forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'メールアドレスを入力'}),
            'first_name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': '名'}),
            'last_name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': '姓'}),
        }

    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get("password")
        password_confirm = cleaned_data.get("password_confirm")

        # パスワードが一致しているかチェック
        if password and password_confirm and password != password_confirm:
            raise forms.ValidationError("パスワードが一致しません。")
        return cleaned_data

    def save(self, commit=True):
        # MobileUser インスタンスを作成
        mobile_user = super().save(commit=False)
        # ユーザー名を使わない仕様のため、メールアドレスをusernameに自動設定
        mobile_user.username = mobile_user.email
        if commit:
            mobile_user.set_password(self.cleaned_data["password"])  # パスワードをハッシュ化して保存
            mobile_user.save()
        return mobile_user