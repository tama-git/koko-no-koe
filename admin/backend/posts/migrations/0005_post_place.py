from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [('posts', '0004_post_admin_moderation')]

    operations = [
        migrations.AddField(
            model_name='post',
            name='place_name',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='post',
            name='place_attribution',
            field=models.JSONField(blank=True, null=True),
        ),
    ]
