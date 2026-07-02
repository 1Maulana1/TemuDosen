"""Phase 2 migration — add CANCELLED status and rejection_reason to Submission."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('submissions', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='submission',
            name='rejection_reason',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AlterField(
            model_name='submission',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Menunggu'),
                    ('approved', 'Disetujui'),
                    ('rejected', 'Ditolak'),
                    ('revision', 'Revisi'),
                    ('cancelled', 'Dibatalkan'),
                ],
                default='pending',
                max_length=20,
            ),
        ),
    ]
