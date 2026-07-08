"""
Management command to seed test accounts for local development/testing only.
Run manually when needed: python manage.py seed_dev
Running twice is safe: uses get_or_create so it will not raise an error.

NOT wired into any docker-compose entrypoint — unlike seed_admin.py, these
accounts use a weak shared test password and must never be auto-seeded into a
production-like deployment.

Semua akun demo memakai SATU password yang sama: `demo123`. Password di-set
ulang setiap kali command dijalankan, jadi menjalankan ulang menyeragamkan
password akun lama juga.
"""
from django.core.management.base import BaseCommand

from apps.accounts.models import CustomUser, UserRole

# Satu password untuk semua akun demo (dosen, mahasiswa, ketua jurusan).
DEMO_PASSWORD = 'demo123'


# --- Dosen (lecturers) ---
# (email, full_name, nidn)
LECTURERS = [
    ('siti.rahayu@uii.ac.id', 'Dr. Siti Rahayu, M.Kom', '0012345678'),
    ('budi.santoso@uii.ac.id', 'Dr. Budi Santoso, M.T', '0087654321'),
    ('rina.wijaya@uii.ac.id', 'Dr. Rina Wijaya, M.Kom', '0011223344'),
    ('agus.pratama@uii.ac.id', 'Agus Pratama, S.Kom., M.Cs', '0055667788'),
    ('maya.sari@uii.ac.id', 'Dr. Maya Sari, M.T', '0099887766'),
]

# --- Mahasiswa (students) ---
# (email, full_name, nim, adviser_email)
STUDENTS = [
    ('arifin@students.uii.ac.id', 'Arifin Rahmat', '20210001', 'siti.rahayu@uii.ac.id'),
    ('dewi@students.uii.ac.id', 'Dewi Kusuma', '20210002', 'budi.santoso@uii.ac.id'),
    ('rizky@students.uii.ac.id', 'Rizky Ramadhan', '20210003', 'siti.rahayu@uii.ac.id'),
    ('putri@students.uii.ac.id', 'Putri Anggraini', '20210004', 'rina.wijaya@uii.ac.id'),
    ('fajar@students.uii.ac.id', 'Fajar Nugroho', '20210005', 'budi.santoso@uii.ac.id'),
    ('siska@students.uii.ac.id', 'Siska Amelia', '20210006', 'agus.pratama@uii.ac.id'),
    ('andi@students.uii.ac.id', 'Andi Saputra', '20210007', 'maya.sari@uii.ac.id'),
    ('nabila@students.uii.ac.id', 'Nabila Zahra', '20210008', 'rina.wijaya@uii.ac.id'),
]

# --- Ketua Jurusan (kaprodi) ---
# NOTE: different email from ketuajurusan@temudosen.ac.id (seed_admin.py) — all coexist.
# (email, full_name)
KETUA_JURUSAN = [
    ('ketuajurusan@uii.ac.id', 'Prof. Ahmad Fauzi'),
    ('kaprodi.ti@uii.ac.id', 'Dr. Hendra Gunawan, M.Kom'),
]


class Command(BaseCommand):
    help = 'Seed dosen/mahasiswa/ketua-jurusan test accounts for local development (manual only).'

    def _ensure(self, email, defaults, label):
        """Idempotently create a user and (re)set the shared demo password every run."""
        user, created = CustomUser.objects.get_or_create(email=email, defaults=defaults)
        user.set_password(DEMO_PASSWORD)
        user.save()
        verb = 'Created' if created else 'Updated password'
        self.stdout.write(self.style.SUCCESS(f'{verb} {label}: {email} / {DEMO_PASSWORD}'))
        return user

    def handle(self, *args, **options):
        # --- Dosen ---
        advisers = {}
        for email, full_name, nidn in LECTURERS:
            advisers[email] = self._ensure(
                email,
                {
                    'full_name': full_name,
                    'role': UserRole.LECTURER,
                    'nidn': nidn,
                    'is_approved': True,
                },
                'dosen',
            )

        # --- Mahasiswa ---
        for email, full_name, nim, adviser_email in STUDENTS:
            self._ensure(
                email,
                {
                    'full_name': full_name,
                    'role': UserRole.STUDENT,
                    'nim': nim,
                    'is_approved': True,
                    'adviser': advisers.get(adviser_email),
                },
                'mahasiswa',
            )

        # --- Ketua Jurusan ---
        for email, full_name in KETUA_JURUSAN:
            self._ensure(
                email,
                {
                    'full_name': full_name,
                    'role': UserRole.KETUA_JURUSAN,
                    'is_approved': True,
                },
                'ketua jurusan',
            )
