from django.urls import path
from . import views

app_name = "preview"
urlpatterns = [
    path("", views.dashboard, name="dashboard"),
    path("reports/<int:report_id>/", views.report_detail, name="report-detail"),
]
