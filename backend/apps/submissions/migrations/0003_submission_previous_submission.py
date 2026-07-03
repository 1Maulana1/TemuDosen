"""FR-D01 — link a resubmitted (REVISION) submission back to the original."""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('submissions', '0002_submission_phase2'),
    ]

    operations = [
        migrations.AddField(
            model_name='submission',
            name='previous_submission',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='resubmissions',
                to='submissions.submission',
            ),
        ),
    ]
