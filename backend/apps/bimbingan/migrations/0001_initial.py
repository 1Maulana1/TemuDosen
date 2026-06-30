"""Initial migration for bimbingan app — Phase 2."""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('submissions', '0002_submission_phase2'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SystemLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('level', models.CharField(
                    choices=[('INFO', 'Info'), ('WARNING', 'Peringatan'), ('ERROR', 'Error')],
                    default='INFO',
                    max_length=10,
                )),
                ('event_type', models.CharField(blank=True, default='', max_length=50)),
                ('message', models.TextField()),
                ('context', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='Session',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(
                    choices=[
                        ('waiting', 'Menunggu'),
                        ('in_progress', 'Berlangsung'),
                        ('done', 'Selesai'),
                        ('cancelled', 'Dibatalkan'),
                    ],
                    default='waiting',
                    max_length=20,
                )),
                ('method', models.CharField(
                    blank=True,
                    choices=[('offline', 'Offline'), ('online', 'Online')],
                    max_length=10,
                    null=True,
                )),
                ('meeting_link', models.URLField(blank=True, null=True)),
                ('estimated_minutes', models.PositiveIntegerField(default=0)),
                ('scheduled_at', models.DateTimeField(blank=True, null=True)),
                ('notification_sent', models.BooleanField(default=False)),
                ('google_event_id', models.CharField(blank=True, max_length=255, null=True)),
                ('ts1', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('submission', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='session',
                    to='submissions.submission',
                )),
            ],
            options={
                'ordering': ['scheduled_at'],
            },
        ),
        migrations.CreateModel(
            name='DosenCalendarToken',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('access_token_enc', models.TextField()),
                ('refresh_token_enc', models.TextField()),
                ('expires_at', models.DateTimeField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('dosen', models.OneToOneField(
                    limit_choices_to={'role': 'lecturer'},
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='calendar_token',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
        ),
    ]
