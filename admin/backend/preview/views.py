from django.http import Http404
from django.shortcuts import render
from django.views.decorators.http import require_GET

from .sample_data import REPORTS


@require_GET
def dashboard(request):
    active_filter = request.GET.get("status", "all")
    if active_filter not in {"all", "pending", "reviewed"}:
        active_filter = "all"
    reports = [r for r in REPORTS if active_filter == "all" or r["status"] == active_filter]
    return render(request, "admin_preview/dashboard.html", {
        "reports": reports,
        "active_filter": active_filter,
        "total_count": len(REPORTS),
        "pending_count": sum(r["status"] == "pending" for r in REPORTS),
        "reviewed_count": sum(r["status"] == "reviewed" for r in REPORTS),
    })


@require_GET
def report_detail(request, report_id):
    report = next((r for r in REPORTS if r["id"] == report_id), None)
    if report is None:
        raise Http404("サンプル通報が見つかりません。")
    return render(request, "admin_preview/report_detail.html", {"report": report})
