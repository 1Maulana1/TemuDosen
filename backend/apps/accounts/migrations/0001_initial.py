"""
Initial migration for the CustomUser model.
Generated after AUTH_USER_MODEL = 'accounts.CustomUser' was set in base.py (Pitfall 1 prevention).
"""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.CreateModel(
            name='CustomUser',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('password', models.CharField(max_length=128, verbose_name='password')),
                ('last_login', models.DateTimeField(blank=True, null=True, verbose_name='last login')),
                ('is_superuser', models.BooleanField(default=False, help_text='Designates that this user has all permissions without explicitly assigning them.', verbose_name='superuser status')),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('full_name', models.CharField(max_length=255)),
                ('role', models.CharField(
                    choices=[('student', 'Mahasiswa'), ('lecturer', 'Dosen'), ('admin', 'Admin'), ('kaprodi', 'Kaprodi')],
                    default='student',
                    max_length=20,
                )),
                ('nim', models.CharField(
                    blank=True,
                    help_text='Student matriculation number (NIM). Null for non-students.',
                    max_length=20,
                    null=True,
                    unique=True,
                )),
                ('nidn', models.CharField(
                    blank=True,
                    help_text='Lecturer national ID (NIDN). Null for non-lecturers.',
                    max_length=20,
                    null=True,
                    unique=True,
                )),
                ('is_approved', models.BooleanField(
                    default=False,
                    help_text='Set to True by Admin to grant full access (D-20).',
                )),
                ('is_active', models.BooleanField(default=True)),
                ('is_staff', models.BooleanField(default=False)),
                ('google_oauth_token', models.JSONField(
                    blank=True,
                    help_text='Google Calendar OAuth2 token. Set in Phase 4.',
                    null=True,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('adviser', models.ForeignKey(
                    blank=True,
                    help_text='Assigned thesis adviser (lecturers only). Set by student at registration.',
                    limit_choices_to={'role': 'lecturer'},
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='advisees',
                    to='accounts.customuser',
                )),
                ('groups', models.ManyToManyField(
                    blank=True,
                    help_text='The groups this user belongs to.',
                    related_name='user_set',
                    related_query_name='user',
                    to='auth.group',
                    verbose_name='groups',
                )),
                ('user_permissions', models.ManyToManyField(
                    blank=True,
                    help_text='Specific permissions for this user.',
                    related_name='user_set',
                    related_query_name='user',
                    to='auth.permission',
                    verbose_name='user permissions',
                )),
            ],
            options={
                'verbose_name': 'User',
                'verbose_name_plural': 'Users',
                'db_table': 'accounts_user',
            },
        ),
    ]
