from django.db import models as db_models
from rest_framework import generics, status
from rest_framework.exceptions import APIException, NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response

from posts.authentication import MobileBearerAuthentication
from posts.models import Post
from .models import PostReaction, REACTION_EMOJIS


class ReactionAccess:
    """
    リアクションAPIに共通する認証・キャッシュ設定
    """

    authentication_classes = [MobileBearerAuthentication]
    permission_classes = [IsAuthenticated]
    renderer_classes = [JSONRenderer]

    def finalize_response(self, request, response, *args, **kwargs):
        # リアクション情報をキャッシュさせない
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'private, no-store'
        return response


class AlreadyReacted(APIException):
    """
    同じ投稿に2回リアクションしようとしたときのエラー
    """

    status_code = status.HTTP_409_CONFLICT
    default_detail = 'この投稿にはすでにリアクション済みです。'


class PostReactionAPIView(ReactionAccess, generics.GenericAPIView):
    """
    投稿へのリアクションを管理するAPIビュー。
    """

    def _public_post(self, pk):
        # 管理者非表示でない公開投稿を返す。自分の投稿も含む。
        return Post.objects.filter(pk=pk, is_public=True, admin_hidden_at__isnull=True)

    def get(self, request, pk):
        # 絵文字ごとのリアクション数と、ログイン中の会員が選んだ絵文字を返す
        # まず全絵文字のカウントを0で初期化する（DBに行がない絵文字も含めて返すため）
        counts = {e: 0 for e in REACTION_EMOJIS if e != '.'}
        for emoji, count in (
            PostReaction.objects.filter(post_id=pk)
            .values_list('emoji')
            .annotate(total=db_models.Count('id'))
        ):
            if emoji in counts:
                counts[emoji] = count
        # 自分のリアクションを取得（未リアクションの場合は None）
        my = PostReaction.objects.filter(post_id=pk, user=request.user).values_list('emoji', flat=True).first()
        return Response({'counts': counts, 'my_reaction': my})

    def post(self, request, pk):
        # リアクションを送信する。すでにリアクション済みの場合は 409 を返す
        emoji = request.data.get('emoji')
        # '.' は内部値なので送信不可。REACTION_EMOJIS 以外も拒否する。
        if emoji not in REACTION_EMOJIS or emoji == '.':
            return Response({'error': '無効なリアクションです。'}, status=status.HTTP_400_BAD_REQUEST)
        if not self._public_post(pk).exists():
            raise NotFound('リアクションできる投稿が見つかりませんでした。')
        _, created = PostReaction.objects.get_or_create(post_id=pk, user=request.user, defaults={'emoji': emoji})
        if not created:
            raise AlreadyReacted()
        return Response({'status': 'reacted', 'emoji': emoji}, status=status.HTTP_201_CREATED)

    def delete(self, request, pk):
        # 自分のリアクションを取り消す。リアクションがない場合は 404 を返す
        deleted, _ = PostReaction.objects.filter(post_id=pk, user=request.user).delete()
        if not deleted:
            raise NotFound('リアクションが見つかりませんでした。')
        return Response(status=status.HTTP_204_NO_CONTENT)
