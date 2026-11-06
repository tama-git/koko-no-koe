from io import BytesIO

from PIL import Image, ImageOps
from django.http import FileResponse, Http404


def post_photo_preview(image):
    """向きを補正し、撮影時の付加情報を含まないJPEGを返す。"""
    if not image:
        raise Http404('写真がありません。')
    try:
        with image.open('rb') as source, Image.open(source) as photo:
            with ImageOps.exif_transpose(photo).convert('RGB') as preview:
                preview.info.clear()
                output = BytesIO()
                preview.save(output, format='JPEG', quality=90)
    except (OSError, ValueError, Image.DecompressionBombError) as error:
        raise Http404('写真を取得できません。') from error
    output.seek(0)
    return FileResponse(output, content_type='image/jpeg')
