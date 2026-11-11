from functools import wraps

from django.contrib import messages
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.core.paginator import Paginator
from django.db.models import Count, Exists, Max, OuterRef, Q, Value
from django.db.models.functions import Coalesce
from django.http import HttpResponseBadRequest
from django.shortcuts import get_object_or_404, render, redirect
from django.urls import reverse
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET, require_POST, require_http_methods

from posts.images import post_photo_preview
from posts.models import Post, PostReport
from utility.models import Contact

from ..backends import is_admin_account
from .forms import AdminLoginForm, PostReviewForm


PAGE_SIZE = 20
PAGE_SIZES = (10, 20, 50)
REVIEW_ACTIONS = {
    Post.ReportStatus.PENDING: (
        (Post.ReportStatus.REVIEWED, '閲覧済みにする'),
        (Post.ReportStatus.RESOLVED, '対応済みにする'),
    ),
    Post.ReportStatus.REVIEWED: (
        (Post.ReportStatus.PENDING, '要確認に戻す'),
        (Post.ReportStatus.RESOLVED, '対応済みにする'),
    ),
    Post.ReportStatus.RESOLVED: ((Post.ReportStatus.PENDING, '要確認に戻す'),),
}


def admin_required(view):
    @wraps(view)
    def guarded(request, *args, **kwargs):
        if not is_admin_account(request.user):
            raise PermissionDenied('管理者アカウントでログインしてください。')
        return view(request, *args, **kwargs)
    return login_required(guarded, login_url='admin_side:login')

@never_cache
@require_http_methods(['GET', 'POST'])
def admin_login_view(request):
    if request.method == 'POST':
        form = AdminLoginForm(data=request.POST, request=request)
        if form.is_valid():
            user = form.get_user()
            login(request, user)
            # next は使わず、ログイン後は必ず管理者トップへ移動する。
            return redirect('admin_side:dashboard')
    else:
        # GET時は引数なしで空のフォームを作る
        form = AdminLoginForm()
        
    return render(request, 'admin_side/login.html', {'form': form})

@never_cache
@require_GET
@admin_required
def admin_dashboard_view(request, section='overview'):
    keyword = request.GET.get('q', '').strip()[:200]
    date_value = request.GET.get('date', '')
    try:
        selected_date = parse_date(date_value)
    except ValueError:
        selected_date = None
    page_size = next((size for size in PAGE_SIZES if str(size) == request.GET.get('size')), PAGE_SIZE)
    list_controls = {
        'keyword': keyword, 'selected_date': selected_date, 'page_size': page_size,
        'page_sizes': PAGE_SIZES,
        'date_error': bool(date_value and selected_date is None),
    }
    if section == 'posts':
        posts = Post.objects.order_by('-created_at', '-pk')
        if keyword:
            posts = posts.filter(Q(is_public=True, message__icontains=keyword) | _id_search(keyword, 'pk', 'user_id_id'))
        if selected_date:
            posts = posts.filter(created_at__date=selected_date)
        state = request.GET.get('visibility', '')
        visibility_filters = {
            'public': Q(is_public=True, admin_hidden_at__isnull=True),
            'private': Q(is_public=False, admin_hidden_at__isnull=True),
            'hidden': Q(admin_hidden_at__isnull=False),
        }
        if state in visibility_filters:
            posts = posts.filter(visibility_filters[state])
        return render(request, 'admin_side/posts.html', {
            **list_controls, 'visibility': state,
            'post_page': Paginator(posts, page_size).get_page(request.GET.get('post_page')),
        })
    if section == 'contacts':
        contacts = Contact.objects.select_related('user').order_by('-created_at', '-pk')
        if keyword:
            contacts = contacts.filter(Q(message__icontains=keyword) | Q(email__icontains=keyword))
        if selected_date:
            contacts = contacts.filter(created_at__date=selected_date)
        state = request.GET.get('status', '')
        if state in ('pending', 'resolved'):
            contacts = contacts.filter(is_resolved=state == 'resolved')
        return render(request, 'admin_side/contacts.html', {
            **list_controls, 'contact_status': state,
            'contact_page': Paginator(contacts, page_size).get_page(request.GET.get('page')),
        })

    reported_posts = Post.objects.filter(
        Exists(PostReport.objects.filter(post_id=OuterRef('pk')))
    ).annotate(review_state=Coalesce('report_status', Value(Post.ReportStatus.PENDING)))
    status_counts = dict(reported_posts.values_list('review_state').annotate(total=Count('pk')))
    counts = {
        'pending_count': status_counts.get(Post.ReportStatus.PENDING, 0),
        'reported_count': sum(status_counts.values()),
    }
    if section == 'overview':
        return render(request, 'admin_side/dashboard.html', {
            **counts, 'post_count': Post.objects.count(), 'contact_count': Contact.objects.count(),
        })

    status_filter = request.GET.get('status', 'all')
    if status_filter not in ('all', *Post.ReportStatus.values):
        status_filter = 'all'
    filters = [('all', 'すべて', sum(status_counts.values()))]
    filters.extend((state, label, status_counts.get(state, 0)) for state, label in Post.ReportStatus.choices)

    if status_filter != 'all':
        reported_posts = reported_posts.filter(review_state=status_filter)
    reported_posts = reported_posts.annotate(
        report_count=Count('reports'),
        last_report_at=Max('reports__created_at'),
    ).order_by('-last_report_at', '-pk')
    if keyword:
        reported_posts = reported_posts.filter(
            Q(is_public=True, message__icontains=keyword) | _id_search(keyword, 'pk', 'user_id_id'),
        )
    if selected_date:
        reported_posts = reported_posts.filter(last_report_at__date=selected_date)

    report_page = Paginator(reported_posts, page_size).get_page(request.GET.get('report_page'))
    return render(request, 'admin_side/reports.html', {
        **list_controls,
        **counts,
        'report_page': report_page,
        'active_filter': status_filter,
        'filters': filters,
    })


def _id_search(keyword, *fields):
    if keyword.isascii() and keyword.isdecimal() and len(keyword) <= 19:
        value = int(keyword)
        if value <= 2**63 - 1:
            return Q(*[(field, value) for field in fields], _connector=Q.OR)
    return Q(pk__in=[])


@never_cache
@require_POST
@admin_required
def admin_post_hide_from_list(request, pk):
    updated = Post.objects.filter(pk=pk, is_public=True, admin_hidden_at__isnull=True).update(
        admin_hidden_at=timezone.now(),
        admin_hidden_by_id=request.user.pk,
    )
    if updated:
        messages.success(request, '投稿を管理者非表示にしました。')
    else:
        messages.warning(request, '投稿の公開状態が変わっています。一覧を確認してください。')
    url = reverse('admin_side:posts')
    query = request.GET.urlencode()
    return redirect(f'{url}?{query}' if query else url)


@never_cache
@require_POST
@admin_required
def admin_contact_status_view(request, pk):
    status = request.POST.get('status')
    if status not in ('resolved', 'pending'):
        return HttpResponseBadRequest('お問い合わせの対応状態を確認できませんでした。')

    contact = get_object_or_404(Contact, pk=pk)
    contact.is_resolved = status == 'resolved'
    contact.save(update_fields=['is_resolved'])

    url = (reverse('admin_side:contacts') if request.POST.get('return_to') == 'list'
           else reverse('contact-admin-detail', args=[contact.pk]))
    query = request.GET.urlencode()
    return redirect(f'{url}?{query}' if query else url)


@never_cache
@require_GET
@admin_required
def admin_post_detail_view(request, pk):
    post = get_object_or_404(Post.objects.select_related('admin_hidden_by'), pk=pk)
    reports = post.reports.order_by('-created_at', '-pk')
    state = post.report_status or Post.ReportStatus.PENDING
    return render(request, 'admin_side/post_detail.html', {
        'post': post,
        'reports': Paginator(reports, PAGE_SIZE).get_page(request.GET.get('reason_page')),
        'back_route': 'admin_side:reports' if request.GET.get('source') == 'reports' else 'admin_side:posts',
        'report_id': reports.order_by('-pk').values_list('pk', flat=True).first(),
        'review_state': state,
        'review_actions': REVIEW_ACTIONS.get(state, ()),
    })


@never_cache
@require_POST
@admin_required
def admin_post_review_view(request, pk):
    form = PostReviewForm(request.POST)
    if not form.is_valid():
        return HttpResponseBadRequest('通報対応の操作を確認できませんでした。')

    action = form.cleaned_data['action']
    state = form.cleaned_data['expected_state']
    report_id = form.cleaned_data['report_id']
    state_filter = Q(report_status=state)
    if state == Post.ReportStatus.PENDING:
        state_filter |= Q(report_status__isnull=True)

    reports = PostReport.objects.filter(post_id=OuterRef('pk'))
    # 詳細を開いた後に新しい通報や状態変更があれば、古い画面からの更新を拒否する。
    target = Post.objects.filter(state_filter, pk=pk).filter(
        Exists(reports.filter(pk=report_id)), ~Exists(reports.filter(pk__gt=report_id)),
    )
    if action == 'hide':
        updated = target.filter(is_public=True, admin_hidden_at__isnull=True).update(
            admin_hidden_at=timezone.now(),
            admin_hidden_by_id=request.user.pk,
            report_status=Post.ReportStatus.RESOLVED,
        )
    elif action in dict(REVIEW_ACTIONS[state]):
        updated = target.update(report_status=action)
    else:
        return HttpResponseBadRequest('この状態から選択した操作はできません。')

    if updated:
        messages.success(request, '投稿を管理者非表示にしました。' if action == 'hide' else '通報の状態を更新しました。')
    else:
        messages.warning(request, '投稿または通報の状態が変わっています。最新の内容を確認してください。')

    url = reverse('admin_side:post-detail', args=[pk])
    query = request.GET.urlencode()
    return redirect(f'{url}?{query}' if query else url)


@never_cache
@require_GET
@admin_required
def admin_post_photo_view(request, pk):
    post = get_object_or_404(Post, Q(is_public=True) | Q(admin_hidden_at__isnull=False), pk=pk)
    return post_photo_preview(post.image)


@never_cache
@require_POST
@admin_required
def admin_logout_view(request):
    """
    管理者用ログアウト処理
    """
    logout(request)
    return redirect('admin_side:login')
