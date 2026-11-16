import re
from io import BytesIO

from PIL import Image, ImageCms, ImageOps
from django.core.files.base import ContentFile
from django.http import FileResponse, Http404

from .models import Post


MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_INPUT_PIXELS = 25_000_000
MAX_SAVED_BYTES = 2 * 1024 * 1024
MAX_PHOTO_SIDE = 1920
JPEG_QUALITY = 85
NORMALIZED_PHOTO_DIRECTORY = 'posts/normalized-v1/'
THUMBNAIL_DIRECTORY = 'posts/thumbnails-v1/'
MAX_THUMBNAIL_SIDE = 640
THUMBNAIL_JPEG_QUALITY = 75


class InvalidPostPhoto(ValueError):
    pass


def _save_color(photo):
    """色プロファイルがあればsRGBに変換し、透過部分は白で合成する。"""
    alpha = photo.convert('RGBA').getchannel('A') if photo.has_transparency_data else None
    profile = photo.info.get('icc_profile')
    if profile:
        mode = 'L' if photo.mode == 'LA' else photo.mode
        if mode not in ('L', 'CMYK'):
            mode = 'RGB'
        with photo.convert(mode) as color:
            rgb = ImageCms.profileToProfile(
                color, BytesIO(profile), ImageCms.createProfile('sRGB'), outputMode='RGB',
            )
    elif photo.mode in ('I', 'I;16', 'I;16B', 'I;16L'):
        # 16ビットPNGの階調を8ビットJPEGに収まる範囲へ変換する。
        with photo.convert('I') as grayscale, grayscale.point(lambda value: value / 257 + 0.5) as scaled:
            rgb = scaled.convert('RGB')
    else:
        rgb = photo.convert('RGB')
    if alpha is None:
        return rgb

    with alpha, rgb:
        background = Image.new('RGB', photo.size, 'white')
        background.paste(rgb, mask=alpha)
        return background


def normalize_post_photo(upload):
    if upload.size > MAX_UPLOAD_BYTES:
        limit_mib = MAX_UPLOAD_BYTES / (1024 * 1024)
        raise InvalidPostPhoto(f'アップロードする写真は{limit_mib:g} MiB以下にしてください。')

    pixel_limit_message = f'写真は{MAX_INPUT_PIXELS:,}画素以下にしてください。'

    try:
        upload.seek(0)
        with Image.open(upload, formats=('JPEG', 'PNG')) as photo:
            if photo.width * photo.height > MAX_INPUT_PIXELS:
                raise InvalidPostPhoto(pixel_limit_message)
            if getattr(photo, 'is_animated', False):
                raise InvalidPostPhoto('静止画のJPEGまたはPNGを選んでください。')
            photo.verify()

        upload.seek(0)
        with Image.open(upload, formats=('JPEG', 'PNG')) as photo, BytesIO() as output:
            ImageOps.exif_transpose(photo, in_place=True)
            with _save_color(photo) as rgb:
                rgb.thumbnail((MAX_PHOTO_SIDE, MAX_PHOTO_SIDE), Image.Resampling.LANCZOS)
                rgb.info.clear()
                rgb.save(output, format='JPEG', quality=JPEG_QUALITY)
            if output.tell() > MAX_SAVED_BYTES:
                limit_mib = MAX_SAVED_BYTES / (1024 * 1024)
                raise InvalidPostPhoto(f'変換後の写真が{limit_mib:g} MiBを超えています。別の写真を撮影してください。')
            return ContentFile(output.getvalue(), name='photo.jpg')
    except InvalidPostPhoto:
        raise
    except Image.DecompressionBombError as error:
        raise InvalidPostPhoto(pixel_limit_message) from error
    except (OSError, SyntaxError, ValueError, ImageCms.PyCMSError) as error:
        raise InvalidPostPhoto('写真を読み込めませんでした。JPEGまたはPNGで撮影し直してください。') from error


def post_thumbnail_name(photo_name):
    """正規化済み画像の保存名からだけサムネイル名を組み立てる。"""
    if not photo_name or not photo_name.startswith(NORMALIZED_PHOTO_DIRECTORY):
        return None
    filename = photo_name[len(NORMALIZED_PHOTO_DIRECTORY):]
    if not re.fullmatch(r'[a-f0-9]{32}\.jpg', filename):
        return None
    return THUMBNAIL_DIRECTORY + filename


def create_post_thumbnail(source):
    with Image.open(source, formats=('JPEG',)) as photo, BytesIO() as output:
        photo.thumbnail((MAX_THUMBNAIL_SIDE, MAX_THUMBNAIL_SIDE), Image.Resampling.LANCZOS)
        photo.info.clear()
        photo.save(output, format='JPEG', quality=THUMBNAIL_JPEG_QUALITY)
        return ContentFile(output.getvalue())


def delete_unreferenced_post_photo(name):
    if not name or Post.objects.filter(image=name).exists():
        return
    storage = Post._meta.get_field('image').storage
    thumbnail_name = post_thumbnail_name(name)
    if thumbnail_name:
        storage.delete(thumbnail_name)
    storage.delete(name)


def post_photo_preview(image):
    """向きを補正し、撮影時の付加情報を含まないJPEGを返す。"""
    if not image:
        raise Http404('写真がありません。')
    try:
        if image.name.startswith(NORMALIZED_PHOTO_DIRECTORY):
            return FileResponse(image.open('rb'), content_type='image/jpeg')
        with image.open('rb') as source, Image.open(source) as photo:
            with ImageOps.exif_transpose(photo).convert('RGB') as preview:
                preview.info.clear()
                output = BytesIO()
                preview.save(output, format='JPEG', quality=90)
    except (OSError, ValueError, Image.DecompressionBombError) as error:
        raise Http404('写真を取得できません。') from error
    output.seek(0)
    return FileResponse(output, content_type='image/jpeg')
