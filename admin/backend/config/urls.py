from django.contrib import admin
from django.urls import include, path
from django.shortcuts import redirect

urlpatterns = [
    # Django標準の管理画面（必要に応じて残すか、今回はバイパスするため使わなくてもOKです）
    path('admin/', admin.site.urls),

    # ここを追加：管理者用のカスタムルーティング
    path('management/', include('accounts.admin_side.urls')),

    # 会員用のカスタムルーティング
    path('mobile/', include('accounts.mobile.urls')),
    path('api/mobile/', include('accounts.mobile.api_urls')),
]
