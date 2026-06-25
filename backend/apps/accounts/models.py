"""
CustomUser model using AbstractBaseUser + PermissionsMixin.
AUTH_USER_MODEL = 'accounts.CustomUser' is set in settings/base.py BEFORE any migration.
Do NOT use AbstractUser — it bundles username/first_name/last_name which conflicts with NIM/NIDN.
"""
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from .managers import CustomUserManager


class UserRole(models.TextChoices):
    STUDENT = 'student', 'Mahasiswa'
    LECTURER = 'lecturer', 'Dosen'
    ADMIN = 'admin', 'Admin'
    KAPRODI = 'kaprodi', 'Kaprodi'


class CustomUser(AbstractBaseUser, PermissionsMixin):
    """
    Multi-role user model.

    Fields:
    - email: unique login identifier (USERNAME_FIELD)
    - full_name: required display name
    - role: one of student / lecturer / admin / kaprodi
    - nim: student matriculation number (unique, null for non-students)
    - nidn: lecturer national ID number (unique, null for non-lecturers)
    - is_approved: False after registration until Admin approves (D-20)
    - is_active: can log in at all
    - is_staff: access Django admin interface
    - google_oauth_token: Phase 4 forward-compat for Google Calendar OAuth
    - adviser: self-FK to a lecturer (student sets at registration, D-24)
    - created_at: timestamp of account creation
    """

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255)
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.STUDENT,
    )
    nim = models.CharField(
        max_length=20, unique=True, null=True, blank=True,
        help_text='Student matriculation number (NIM). Null for non-students.'
    )
    nidn = models.CharField(
        max_length=20, unique=True, null=True, blank=True,
        help_text='Lecturer national ID (NIDN). Null for non-lecturers.'
    )
    is_approved = models.BooleanField(
        default=False,
        help_text='Set to True by Admin to grant full access (D-20).'
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    # Phase 4 forward-compat: Google Calendar OAuth2 token storage (D-26)
    google_oauth_token = models.JSONField(
        null=True, blank=True,
        help_text='Google Calendar OAuth2 token. Set in Phase 4.'
    )

    # Student–Lecturer advising relationship (D-24)
    # limit_choices_to enforces that only lecturers can be assigned as advisers
    adviser = models.ForeignKey(
        'self',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='advisees',
        limit_choices_to={'role': UserRole.LECTURER},
        help_text='Assigned thesis adviser (lecturers only). Set by student at registration.'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    class Meta:
        db_table = 'accounts_user'
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return f'{self.full_name} <{self.email}> [{self.role}]'
