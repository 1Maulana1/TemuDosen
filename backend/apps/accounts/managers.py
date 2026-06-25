"""Custom user manager for CustomUser (AbstractBaseUser)."""
from django.contrib.auth.models import BaseUserManager


class CustomUserManager(BaseUserManager):
    """Manager with create_user and create_superuser methods."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email wajib diisi.')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        from .models import UserRole
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', UserRole.ADMIN)
        extra_fields.setdefault('is_approved', True)
        extra_fields.setdefault('full_name', 'Super Admin')

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)
