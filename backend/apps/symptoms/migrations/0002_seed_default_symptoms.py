"""
Data migration — seed the 6 default symptom categories (D-02, RESEARCH Pattern 5).

Runs automatically on every fresh migrate via RunPython.
Reverse operation is intentionally non-destructive (D-08: weights persist until manually updated).
"""
from django.db import migrations

DEFAULT_SYMPTOMS = [
    ('Metodologi penelitian', 60),      # Thesis methodology
    ('Analisis data', 45),              # Data analysis
    ('Penulisan & struktur', 30),       # Writing & structure
    ('Tinjauan pustaka', 30),           # Literature review
    ('Manajemen waktu', 30),            # Time management
    ('Konflik dengan pembimbing', 45),  # Supervisor conflict
]


def seed_symptoms(apps, schema_editor):
    """Create the 6 default categories if they do not already exist."""
    SymptomCategory = apps.get_model('symptoms', 'SymptomCategory')
    for name, duration in DEFAULT_SYMPTOMS:
        SymptomCategory.objects.get_or_create(
            name=name,
            defaults={'duration_minutes': duration, 'is_active': True},
        )


def unseed_symptoms(apps, schema_editor):
    """Reverse op: intentionally non-destructive — do not delete seeded data (D-08)."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('symptoms', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_symptoms, unseed_symptoms),
    ]
