from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('posts', '0005_post_place')]

    operations = [
        migrations.AddField(
            model_name='post',
            name='manual_place',
            field=models.JSONField(blank=True, editable=False, null=True),
        ),
    ]
