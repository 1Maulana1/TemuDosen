"""FR-AD01 — add category field to SymptomCategory."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('symptoms', '0002_seed_default_symptoms'),
    ]

    operations = [
        migrations.AddField(
            model_name='symptomcategory',
            name='category',
            field=models.CharField(default='Umum', max_length=100),
        ),
    ]
