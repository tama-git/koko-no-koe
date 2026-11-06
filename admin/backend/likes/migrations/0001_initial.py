from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('accounts', '0002_mobilesession'),
        ('posts', '0004_post_admin_moderation'),
    ]

    operations = [
        migrations.CreateModel(
            name='PostReaction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('emoji', models.CharField(max_length=8)),
                ('post', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reactions', to='posts.post')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reactions', to='accounts.mobileuser')),
            ],
            options={'db_table': 'POST_REACTION'},
        ),
        migrations.AddConstraint(
            model_name='postreaction',
            constraint=models.UniqueConstraint(fields=['post', 'user'], name='unique_reaction_per_post'),
        ),
    ]
