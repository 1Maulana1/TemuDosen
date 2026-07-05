"""
Phase 6 merge — pindahkan data ringkasan lama dari Session ke SessionLogbook.

Untuk setiap Session yang punya `summary` terisi, buat satu baris SessionLogbook
(is_manual=True, status=approved) sehingga tidak ada data ringkasan yang hilang saat
kolom Session.summary / summary_approved_at dihapus di migrasi berikutnya (0007).

Reversible: menghapus logbook hasil backfill (is_manual=True yang berasal dari sini).
"""
from django.db import migrations


def backfill_forward(apps, schema_editor):
    Session = apps.get_model('bimbingan', 'Session')
    SessionLogbook = apps.get_model('logbook', 'SessionLogbook')

    for session in Session.objects.exclude(summary='').iterator():
        if SessionLogbook.objects.filter(session_id=session.id).exists():
            continue
        SessionLogbook.objects.create(
            session_id=session.id,
            status='approved',
            is_manual=True,
            summary_edited={'manual_notes': session.summary},
            approved_at=session.summary_approved_at,
            source_mode=(session.method or 'offline'),
        )


def backfill_reverse(apps, schema_editor):
    # Hanya hapus baris hasil backfill (manual, tanpa transkrip/summary_raw).
    SessionLogbook = apps.get_model('logbook', 'SessionLogbook')
    SessionLogbook.objects.filter(
        is_manual=True, transcript='', summary_raw={},
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('bimbingan', '0005_session_summary_session_summary_approved_at'),
        ('logbook', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(backfill_forward, backfill_reverse),
    ]
