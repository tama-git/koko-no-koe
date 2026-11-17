from time import sleep

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db.models import Count, Q

from ...models import Post
from ...place_names import PostPlaceServiceError, lookup_post_place


class Command(BaseCommand):
    help = '保存済み投稿の座標から、未設定の地名と出典を補います。既定では対象件数の確認のみです。'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true', help='Geoapifyへ照会して結果を保存する')

    def handle(self, *args, **options):
        candidates = Post.objects.filter(place_name='', latitude__range=(-90, 90), longitude__range=(-180, 180))
        public = Q(is_public=True, admin_hidden_at__isnull=True)
        totals = candidates.aggregate(
            total=Count('pk'),
            public=Count('pk', filter=public),
        )
        total = totals['total']
        public_count = totals['public']
        self.stdout.write(f'対象 {total}件（公開中 {public_count}件、非公開・非表示等 {total - public_count}件）')
        if not options['apply'] or not total:
            return
        if not settings.GEOAPIFY_API_KEY:
            raise CommandError('GEOAPIFY_API_KEY を実行するPowerShellで設定してください。')

        saved = 0
        unresolved = 0
        for post_id, latitude, longitude in candidates.order_by('pk').values_list('pk', 'latitude', 'longitude'):
            try:
                place = lookup_post_place(latitude, longitude, strict=True)
            except PostPlaceServiceError as error:
                raise CommandError(f'照会を中断しました。保存済み {saved}件。{error}') from None
            if place is None:
                unresolved += 1
            else:
                name, attribution = place
                saved += candidates.filter(pk=post_id, latitude=latitude, longitude=longitude).update(
                    place_name=name, place_attribution=attribution,
                )
            sleep(0.25)
        self.stdout.write(f'保存 {saved}件、地名未取得 {unresolved}件')
