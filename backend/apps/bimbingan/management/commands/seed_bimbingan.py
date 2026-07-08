"""
Seed demo bimbingan (guidance) data for local development/testing only.
Run manually: python manage.py seed_bimbingan

Depends on `seed_dev` having created the demo users first. Creates a spread of
guidance states across students so the dosen & ketua-jurusan dashboards look
populated:

  - pending submission (menunggu konfirmasi dosen)
  - approved + session menunggu di antrean
  - approved + session sedang berlangsung
  - selesai + logbook disetujui + saran/tindak lanjut (ActionItem)
  - submission revisi (dengan catatan dosen)

Idempotent by student: a student who already has any submission is skipped, so
re-running won't duplicate and won't touch data seeded elsewhere (e.g. Arifin).

NOT wired into any entrypoint — demo data only, never for production.
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import CustomUser, UserRole
from apps.symptoms.models import SymptomCategory
from apps.submissions.models import Submission
from apps.bimbingan.models import Session, ActionItem
from apps.logbook.models import SessionLogbook


class Command(BaseCommand):
    help = 'Seed demo bimbingan data (submissions/sessions/logbooks/action-items) for local dev.'

    def handle(self, *args, **options):
        self.now = timezone.now()
        self.symptoms = {s.name: s for s in SymptomCategory.objects.all()}
        if not self.symptoms:
            self.stderr.write(self.style.ERROR(
                'Belum ada SymptomCategory. Jalankan seeder gejala terlebih dahulu.'))
            return

        students = {s.email: s for s in CustomUser.objects.filter(role=UserRole.STUDENT)}

        # (student_email, scenario) — scenario builder methods below.
        scenarios = [
            ('rizky@students.uii.ac.id', self._scenario_done),
            ('fajar@students.uii.ac.id', self._scenario_done),
            ('siska@students.uii.ac.id', self._scenario_done),
            ('putri@students.uii.ac.id', self._scenario_in_progress),
            ('nabila@students.uii.ac.id', self._scenario_waiting),
            ('dewi@students.uii.ac.id', self._scenario_pending),
            ('andi@students.uii.ac.id', self._scenario_revision),
        ]

        created = 0
        for email, builder in scenarios:
            student = students.get(email)
            if student is None:
                self.stdout.write(f'Lewati (mahasiswa tidak ada): {email}')
                continue
            if Submission.objects.filter(student=student).exists():
                self.stdout.write(f'Lewati (sudah punya submission): {email}')
                continue
            builder(student)
            created += 1
            self.stdout.write(self.style.SUCCESS(
                f'Seed bimbingan [{builder.__name__.replace("_scenario_", "")}]: {email}'))

        self.stdout.write(self.style.SUCCESS(f'Selesai — {created} skenario bimbingan dibuat.'))

    # ── helpers ────────────────────────────────────────────────────────────────

    def _symptoms(self, *names):
        return [self.symptoms[n] for n in names if n in self.symptoms]

    def _submission(self, student, symptom_names, description, status):
        sub = Submission.objects.create(
            student=student, description=description, status=status)
        syms = self._symptoms(*symptom_names)
        sub.symptoms.set(syms)
        est = sum(s.duration_minutes for s in syms) or 30
        return sub, est

    def _session(self, submission, status, estimated, *, method='offline',
                 scheduled_at=None, ts1=None, ts2=None, consent=False):
        return Session.objects.create(
            submission=submission,
            status=status,
            method=method,
            meeting_link='https://meet.google.com/demo-xyz' if method == 'online' else None,
            estimated_minutes=estimated,
            scheduled_at=scheduled_at,
            ts1=ts1,
            ts2=ts2,
            consent_given_at=self.now if consent else None,
            consent_by_dosen=consent,
            consent_by_mahasiswa=consent,
        )

    # ── scenarios ──────────────────────────────────────────────────────────────

    def _scenario_pending(self, student):
        """Submission menunggu keputusan dosen (belum ada sesi)."""
        self._submission(
            student, ['Metodologi penelitian', 'Tinjauan pustaka'],
            'Bingung menentukan metode penelitian yang sesuai untuk topik saya.',
            Submission.Status.PENDING)

    def _scenario_revision(self, student):
        """Submission dikembalikan dosen untuk revisi."""
        sub, _ = self._submission(
            student, ['Penulisan & struktur'],
            'Draft Bab I untuk ditinjau.',
            Submission.Status.REVISION)
        sub.rejection_reason = (
            'Latar belakang masih terlalu umum. Perkuat rumusan masalah dan '
            'tambahkan data pendukung sebelum diajukan ulang.')
        sub.save(update_fields=['rejection_reason'])

    def _scenario_waiting(self, student):
        """Disetujui, sesi menunggu di antrean (dijadwalkan beberapa jam ke depan)."""
        sub, est = self._submission(
            student, ['Analisis data'],
            'Perlu bimbingan interpretasi hasil uji statistik.',
            Submission.Status.APPROVED)
        self._session(
            sub, Session.Status.WAITING, est,
            method='online',
            scheduled_at=self.now + timedelta(hours=3))

    def _scenario_in_progress(self, student):
        """Sesi sedang berlangsung (sudah 'Mulai & Rekam')."""
        sub, est = self._submission(
            student, ['Manajemen waktu', 'Penulisan & struktur'],
            'Diskusi progres penulisan Bab III dan target minggu ini.',
            Submission.Status.APPROVED)
        self._session(
            sub, Session.Status.IN_PROGRESS, est,
            method='offline',
            scheduled_at=self.now - timedelta(minutes=15),
            ts1=self.now - timedelta(minutes=12),
            consent=True)

    def _scenario_done(self, student):
        """Sesi selesai + logbook disetujui + saran/tindak lanjut."""
        sub, est = self._submission(
            student, ['Analisis data', 'Metodologi penelitian'],
            'Review hasil analisis data dan penyempurnaan metodologi.',
            Submission.Status.APPROVED)
        scheduled = self.now - timedelta(days=3)
        session = self._session(
            sub, Session.Status.DONE, est,
            method='offline',
            scheduled_at=scheduled,
            ts1=scheduled,
            ts2=scheduled + timedelta(minutes=est),
            consent=True)
        session.result_notes = 'Sesi berjalan lancar, mahasiswa memahami arahan.'
        session.save(update_fields=['result_notes'])

        adviser = student.adviser
        summary = {
            'advice_points': [
                {'topic': 'Analisis Data',
                 'detail': 'Gunakan uji normalitas sebelum menentukan uji hipotesis '
                           'yang tepat; sertakan tabel hasil di lampiran.'},
                {'topic': 'Metodologi',
                 'detail': 'Perjelas populasi dan teknik sampling agar hasil dapat '
                           'digeneralisasi.'},
            ],
            'improvement_notes': [
                {'area': 'Penulisan',
                 'action': 'Rapikan sitasi mengikuti format APA edisi terbaru.'},
            ],
        }
        SessionLogbook.objects.create(
            session=session,
            status=SessionLogbook.Status.APPROVED,
            transcript='(Transkrip demo) Pembahasan hasil analisis data dan langkah metodologi berikutnya…',
            summary_raw=summary,
            summary_edited=summary,
            is_manual=True,
            approved_at=scheduled + timedelta(minutes=est + 5),
            approved_by=adviser,
        )

        # Saran & tindak lanjut (dipakai laporan kepatuhan kaprodi) — 1 selesai, 1 belum.
        ActionItem.objects.create(
            session=session,
            description='Perbaiki uji statistik sesuai arahan dan kirim ulang tabel hasil.',
            is_completed=True,
            completion_note='Sudah diperbaiki dan hasil dilampirkan di draft terbaru.',
            completed_at=self.now - timedelta(days=1),
        )
        ActionItem.objects.create(
            session=session,
            description='Lengkapi bagian metodologi dengan teknik sampling yang jelas.',
            is_completed=False,
        )
