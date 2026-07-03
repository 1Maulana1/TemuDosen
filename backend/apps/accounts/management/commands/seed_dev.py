"""
Management command to seed test accounts for local development/testing only.
Run manually when needed: python manage.py seed_dev
Running twice is safe: uses get_or_create so it will not raise an error.

NOT wired into any docker-compose entrypoint — unlike seed_admin.py, these
accounts use weak test passwords and must never be auto-seeded into a
production-like deployment.
"""
from django.core.management.base import BaseCommand

from apps.accounts.models import CustomUser, UserRole


class Command(BaseCommand):
    help = 'Seed dosen/mahasiswa/ketua-jurusan test accounts for local development (manual only).'

    def handle(self, *args, **options):
        # --- Dosen accounts ---
        siti, created = CustomUser.objects.get_or_create(
            email='siti.rahayu@uii.ac.id',
            defaults={
                'full_name': 'Dr. Siti Rahayu, M.Kom',
                'role': UserRole.LECTURER,
                'nidn': '0012345678',
                'is_approved': True,
            }
        )
        if created:
            siti.set_password('dosen123')
            siti.save()
            self.stdout.write(self.style.SUCCESS(
                'Created dosen: siti.rahayu@uii.ac.id / dosen123'
            ))
        else:
            self.stdout.write('Dosen account already exists: siti.rahayu@uii.ac.id')

        budi, created = CustomUser.objects.get_or_create(
            email='budi.santoso@uii.ac.id',
            defaults={
                'full_name': 'Dr. Budi Santoso, M.T',
                'role': UserRole.LECTURER,
                'nidn': '0087654321',
                'is_approved': True,
            }
        )
        if created:
            budi.set_password('dosen123')
            budi.save()
            self.stdout.write(self.style.SUCCESS(
                'Created dosen: budi.santoso@uii.ac.id / dosen123'
            ))
        else:
            self.stdout.write('Dosen account already exists: budi.santoso@uii.ac.id')

        # --- Mahasiswa accounts ---
        arifin, created = CustomUser.objects.get_or_create(
            email='arifin@students.uii.ac.id',
            defaults={
                'full_name': 'Arifin Rahmat',
                'role': UserRole.STUDENT,
                'nim': '20210001',
                'is_approved': True,
                'adviser': siti,
            }
        )
        if created:
            arifin.set_password('mhs123')
            arifin.save()
            self.stdout.write(self.style.SUCCESS(
                'Created mahasiswa: arifin@students.uii.ac.id / mhs123 (pembimbing: Dr. Siti Rahayu)'
            ))
        else:
            self.stdout.write('Mahasiswa account already exists: arifin@students.uii.ac.id')

        dewi, created = CustomUser.objects.get_or_create(
            email='dewi@students.uii.ac.id',
            defaults={
                'full_name': 'Dewi Kusuma',
                'role': UserRole.STUDENT,
                'nim': '20210002',
                'is_approved': True,
                'adviser': budi,
            }
        )
        if created:
            dewi.set_password('mhs123')
            dewi.save()
            self.stdout.write(self.style.SUCCESS(
                'Created mahasiswa: dewi@students.uii.ac.id / mhs123 (pembimbing: Dr. Budi Santoso)'
            ))
        else:
            self.stdout.write('Mahasiswa account already exists: dewi@students.uii.ac.id')

        # --- Ketua Jurusan account ---
        # NOTE: different email from ketuajurusan@temudosen.ac.id (seed_admin.py) — both coexist.
        ketua_jurusan, created = CustomUser.objects.get_or_create(
            email='ketuajurusan@uii.ac.id',
            defaults={
                'full_name': 'Prof. Ahmad Fauzi',
                'role': UserRole.KETUA_JURUSAN,
                'is_approved': True,
            }
        )
        if created:
            ketua_jurusan.set_password('ketuajurusan123')
            ketua_jurusan.save()
            self.stdout.write(self.style.SUCCESS(
                'Created ketua jurusan: ketuajurusan@uii.ac.id / ketuajurusan123'
            ))
        else:
            self.stdout.write('Ketua Jurusan account already exists: ketuajurusan@uii.ac.id')
