"""FR-M04 — add consent-to-record fields to Session."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bimbingan', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='session',
            name='consent_given_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='session',
            name='consent_by_dosen',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='session',
            name='consent_by_mahasiswa',
            field=models.BooleanField(default=False),
        ),
    ]
