from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('utility', '0001_initial')]

    operations = [
        migrations.AddField(
            model_name='contact',
            name='is_resolved',
            field=models.BooleanField(default=False, verbose_name='対応済み'),
        ),
    ]
