import sys
import warnings
from getpass import GetPassWarning, getpass
from uuid import uuid4

from django import forms
from django.contrib.auth.password_validation import (
    CommonPasswordValidator,
    MinimumLengthValidator,
    NumericPasswordValidator,
    UserAttributeSimilarityValidator,
    validate_password,
)
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import IntegrityError

from accounts.models import AdminUser


class Command(BaseCommand):
    help = '独自管理画面にログインする管理者を対話形式で登録します。'

    def handle(self, *args, **options):
        if not sys.stdin.isatty():
            raise CommandError('PowerShellのターミナルから直接実行してください。')

        try:
            email = forms.EmailField(max_length=254).clean(input('管理者のメールアドレス: ')).lower()
        except ValidationError as error:
            raise CommandError('メールアドレスの形式を確認してください。') from error
        except (EOFError, KeyboardInterrupt) as error:
            raise CommandError('管理者の登録を中止しました。') from error

        if AdminUser.objects.filter(email__iexact=email).exists():
            raise CommandError('このメールアドレスはすでに管理者として登録されています。')

        admin = AdminUser(username=f'admin-{uuid4().hex}', email=email, is_staff=True, is_active=True)
        try:
            with warnings.catch_warnings():
                warnings.simplefilter('error', GetPassWarning)
                password = getpass('パスワード（12文字以上）: ')
                confirmation = getpass('パスワード（確認）: ')
        except (EOFError, KeyboardInterrupt, GetPassWarning) as error:
            raise CommandError('パスワード入力を中止しました。') from error

        if password != confirmation:
            raise CommandError('パスワードと確認入力が一致しません。')
        try:
            validate_password(password, user=admin, password_validators=(
                MinimumLengthValidator(12),
                CommonPasswordValidator(),
                NumericPasswordValidator(),
                UserAttributeSimilarityValidator(),
            ))
        except ValidationError as error:
            raise CommandError(' '.join(error.messages)) from error

        admin.set_password(password)
        try:
            admin.save(force_insert=True)
        except IntegrityError as error:
            raise CommandError('管理者を登録できませんでした。メールアドレスの重複を確認してください。') from error
        self.stdout.write(self.style.SUCCESS('管理者を登録しました。管理者ログイン画面からログインできます。'))
