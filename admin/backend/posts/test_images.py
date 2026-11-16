from io import BytesIO
from unittest.mock import patch

from PIL import Image, ImageCms, PngImagePlugin
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase

from .images import (
    MAX_UPLOAD_BYTES, InvalidPostPhoto, create_post_thumbnail, normalize_post_photo, post_thumbnail_name,
)


def upload_image(size, mode='RGB', format='JPEG', color='white', **options):
    with BytesIO() as buffer, Image.new(mode, size, color) as photo:
        photo.save(buffer, format=format, **options)
        return SimpleUploadedFile('camera.bin', buffer.getvalue())


class PostThumbnailTests(SimpleTestCase):
    def test_thumbnail_preserves_aspect_ratio_and_does_not_upscale(self):
        for size, expected in (
            ((1280, 960), (640, 480)),
            ((960, 1280), (480, 640)),
            ((1280, 1280), (640, 640)),
            ((640, 480), (640, 480)),
            ((90, 160), (90, 160)),
        ):
            with self.subTest(size=size):
                with create_post_thumbnail(upload_image(size)) as thumbnail, Image.open(thumbnail) as photo:
                    self.assertEqual(photo.size, expected)
                    self.assertEqual(photo.format, 'JPEG')

    def test_thumbnail_preserves_normalized_orientation_and_uses_quality_75(self):
        exif = Image.Exif()
        exif[274] = 6
        exif[271] = 'Camera'
        with BytesIO() as source, Image.new('RGB', (500, 1000), 'blue') as original:
            original.paste('red', (0, 0, 500, 500))
            original.save(source, 'JPEG', exif=exif, comment=b'camera info')
            upload = SimpleUploadedFile('camera.jpg', source.getvalue())

        with normalize_post_photo(upload) as normalized, create_post_thumbnail(normalized) as thumbnail:
            with Image.open(thumbnail) as result, Image.open(upload_image((10, 10), quality=75)) as reference:
                self.assertEqual(result.size, (640, 320))
                self.assertGreater(result.getpixel((480, 160))[0], 240)
                self.assertGreater(result.getpixel((160, 160))[2], 240)
                self.assertEqual(result.quantization, reference.quantization)
                self.assertFalse(result.getexif())
                self.assertFalse({'exif', 'comment', 'xmp', 'icc_profile'} & result.info.keys())

    def test_thumbnail_path_only_accepts_canonical_normalized_photo_names(self):
        filename = 'a' * 32 + '.jpg'
        self.assertEqual(
            post_thumbnail_name(f'posts/normalized-v1/{filename}'),
            f'posts/thumbnails-v1/{filename}',
        )
        for invalid in (None, '', f'posts/{filename}', f'posts/normalized-v1/../{filename}',
                        f'posts/normalized-v1/sub/{filename}', f'posts/thumbnails-v1/{filename}'):
            with self.subTest(name=invalid):
                self.assertIsNone(post_thumbnail_name(invalid))


class NormalizePostPhotoTests(SimpleTestCase):
    def test_resizes_without_cropping_or_upscaling(self):
        for original, expected in (
            ((2400, 1200), (1920, 960)),
            ((1200, 2400), (960, 1920)),
            ((2000, 2000), (1920, 1920)),
            ((1920, 960), (1920, 960)),
            ((90, 160), (90, 160)),
        ):
            with self.subTest(original=original):
                with normalize_post_photo(upload_image(original)) as saved, Image.open(saved) as photo:
                    self.assertEqual(saved.name, 'photo.jpg')
                    self.assertEqual(photo.format, 'JPEG')
                    self.assertEqual(photo.size, expected)

    def test_orientation_is_applied_and_metadata_is_stripped_at_quality_85(self):
        exif = Image.Exif()
        exif[274] = 6
        exif[271] = 'Camera'
        exif[306] = '2026:01:01 00:00:00'
        exif[34853] = {1: 'N', 2: (35, 0, 0)}
        profile = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
        upload = upload_image((40, 80), exif=exif, icc_profile=profile, comment=b'camera info',
                              xmp=b'<x:xmpmeta>camera info</x:xmpmeta>')
        with BytesIO() as reference, Image.new('RGB', (80, 40)) as blank:
            blank.save(reference, 'JPEG', quality=85)
            reference.seek(0)
            with normalize_post_photo(upload) as saved, Image.open(saved) as photo, Image.open(reference) as expected:
                self.assertEqual(photo.size, (80, 40))
                self.assertEqual(photo.mode, 'RGB')
                self.assertEqual(photo.quantization, expected.quantization)
                self.assertFalse(photo.getexif())
                self.assertFalse({'icc_profile', 'comment', 'xmp', 'exif'} & photo.info.keys())

    def test_transparent_png_uses_white_background_and_loses_text_metadata(self):
        info = PngImagePlugin.PngInfo()
        info.add_text('camera', 'camera info')
        upload = upload_image((10, 10), mode='RGBA', format='PNG', color=(255, 0, 0, 0), pnginfo=info)
        with normalize_post_photo(upload) as saved, Image.open(saved) as photo:
            self.assertEqual(photo.getpixel((0, 0)), (255, 255, 255))
            self.assertNotIn('camera', photo.info)

    def test_16_bit_grayscale_png_preserves_midtones(self):
        upload = upload_image((10, 10), mode='I;16', format='PNG', color=32768)
        with normalize_post_photo(upload) as saved, Image.open(saved) as photo:
            self.assertEqual(photo.getpixel((0, 0)), (128, 128, 128))

    def test_upload_size_is_checked_before_opening_the_image(self):
        upload = upload_image((10, 10))
        upload.size = MAX_UPLOAD_BYTES + 1
        with patch('posts.images.Image.open') as opened, self.assertRaisesMessage(InvalidPostPhoto, '10 MiB'):
            normalize_post_photo(upload)
        opened.assert_not_called()
        upload.size = MAX_UPLOAD_BYTES
        normalize_post_photo(upload).close()

    def test_pixel_limit_is_inclusive_and_checked_before_decoding(self):
        upload = upload_image((10, 10))
        with patch('posts.images.MAX_INPUT_PIXELS', 100):
            normalize_post_photo(upload).close()
        with patch('posts.images.MAX_INPUT_PIXELS', 99), patch('posts.images.ImageOps.exif_transpose') as decode:
            with self.assertRaisesMessage(InvalidPostPhoto, '99画素'):
                normalize_post_photo(upload)
            decode.assert_not_called()

    def test_saved_size_limit_is_inclusive(self):
        upload = upload_image((10, 10))
        with normalize_post_photo(upload) as result:
            size = result.size
        with patch('posts.images.MAX_SAVED_BYTES', size):
            normalize_post_photo(upload).close()
        with patch('posts.images.MAX_SAVED_BYTES', size - 1), self.assertRaisesMessage(InvalidPostPhoto, 'MiBを超え'):
            normalize_post_photo(upload)

    def test_broken_truncated_and_unsupported_images_are_rejected(self):
        jpeg = upload_image((20, 20)).read()
        for photo in (
            SimpleUploadedFile('fake.jpg', b'not an image'),
            SimpleUploadedFile('cut.jpg', jpeg[:-10]),
            upload_image((10, 10), format='GIF'),
        ):
            with self.subTest(name=photo.name), self.assertRaises(InvalidPostPhoto):
                normalize_post_photo(photo)
