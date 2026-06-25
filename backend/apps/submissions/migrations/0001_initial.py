"""Initial migration for Submission and SubmissionFile models."""
import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('symptoms', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Submission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('description', models.TextField(blank=True)),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'Menunggu'),
                        ('approved', 'Disetujui'),
                        ('rejected', 'Ditolak'),
                        ('revision', 'Revisi'),
                    ],
                    default='pending',
                    max_length=20,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('student', models.ForeignKey(
                    limit_choices_to={'role': 'student'},
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='submissions',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('symptoms', models.ManyToManyField(
                    blank=True,
                    to='symptoms.symptomcategory',
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='SubmissionFile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('uuid', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ('original_filename', models.CharField(max_length=255)),
                ('file_path', models.CharField(max_length=500)),
                ('file_size', models.PositiveIntegerField()),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('submission', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='file',
                    to='submissions.submission',
                )),
            ],
        ),
    ]
