"""
Management command to seed Admin and Kaprodi accounts (D-25).
Run on fresh deployment: python manage.py seed_admin
Running twice is safe: uses get_or_create so it will not raise an error.
"""
from django.core.management.base import BaseCommand

from apps.accounts.models import CustomUser, UserRole


class Command(BaseCommand):
    help = 'Seed admin and kaprodi accounts for initial deployment (D-25).'

    def handle(self, *args, **options):
        # --- Admin account ---
        admin, created = CustomUser.objects.get_or_create(
            email='admin@temudosen.ac.id',
            defaults={
                'full_name': 'System Admin',
                'role': UserRole.ADMIN,
                'is_approved': True,
                'is_staff': True,
                'is_superuser': True,
            }
        )
        if created:
            admin.set_password('ChangeMe123!')
            admin.save()
            self.stdout.write(self.style.SUCCESS(
                'Created admin: admin@temudosen.ac.id / ChangeMe123!'
            ))
        else:
            self.stdout.write('Admin account already exists: admin@temudosen.ac.id')

        # --- Kaprodi account ---
        kaprodi, created = CustomUser.objects.get_or_create(
            email='kaprodi@temudosen.ac.id',
            defaults={
                'full_name': 'Kaprodi',
                'role': UserRole.KAPRODI,
                'is_approved': True,
                'is_staff': False,
                'is_superuser': False,
            }
        )
        if created:
            kaprodi.set_password('ChangeMe123!')
            kaprodi.save()
            self.stdout.write(self.style.SUCCESS(
                'Created kaprodi: kaprodi@temudosen.ac.id / ChangeMe123!'
            ))
        else:
            self.stdout.write('Kaprodi account already exists: kaprodi@temudosen.ac.id')
