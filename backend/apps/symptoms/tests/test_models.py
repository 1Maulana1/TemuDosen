"""
TDD RED — test_models.py for SymptomCategory.

Asserts:
1. After running migrations (via django_db), exactly 6 default categories exist (D-02).
2. Each seeded category has the correct name and duration_minutes (D-04).
3. duration_minutes is a positive integer field (asserting positive value and type).
4. name field has a unique constraint (duplicate raises IntegrityError).
"""
import pytest
from django.db import IntegrityError

from apps.symptoms.models import SymptomCategory


EXPECTED_SEEDS = [
    ('Metodologi penelitian', 60),
    ('Analisis data', 45),
    ('Penulisan & struktur', 30),
    ('Tinjauan pustaka', 30),
    ('Manajemen waktu', 30),
    ('Konflik dengan pembimbing', 45),
]


@pytest.mark.django_db
class TestSymptomCategoryModel:
    """SymptomCategory model unit tests."""

    def test_exactly_six_seeded_categories(self):
        """After migrations run, exactly 6 default categories exist (D-02)."""
        count = SymptomCategory.objects.count()
        assert count == 6, f"Expected 6 seeded categories, got {count}"

    def test_seeded_categories_have_correct_names_and_durations(self):
        """Each seeded category has the correct name and duration_minutes."""
        seed_dict = dict(EXPECTED_SEEDS)
        for name, expected_minutes in EXPECTED_SEEDS:
            category = SymptomCategory.objects.get(name=name)
            assert category.duration_minutes == expected_minutes, (
                f"Expected {name} to have {expected_minutes} minutes, "
                f"got {category.duration_minutes}"
            )

    def test_seeded_categories_are_active_by_default(self):
        """All seeded categories have is_active=True."""
        inactive_count = SymptomCategory.objects.filter(is_active=False).count()
        assert inactive_count == 0, f"Expected all categories to be active, {inactive_count} are inactive"

    def test_duration_minutes_is_positive_integer(self):
        """duration_minutes is a PositiveIntegerField — must be > 0 (D-04)."""
        category = SymptomCategory.objects.first()
        assert isinstance(category.duration_minutes, int)
        assert category.duration_minutes > 0

    def test_name_is_unique(self, db):
        """name field has a unique constraint — duplicate name raises IntegrityError."""
        with pytest.raises(IntegrityError):
            SymptomCategory.objects.create(
                name='Metodologi penelitian',  # already seeded
                duration_minutes=30,
            )

    def test_str_representation(self):
        """__str__ returns 'name (X min)' format."""
        category = SymptomCategory.objects.get(name='Analisis data')
        assert str(category) == 'Analisis data (45 min)'

    def test_ordering_is_by_name(self):
        """Meta ordering is by name (alphabetical)."""
        categories = list(SymptomCategory.objects.values_list('name', flat=True))
        assert categories == sorted(categories), "Categories should be ordered alphabetically by name"

    def test_has_created_at_and_updated_at(self):
        """Model has created_at and updated_at timestamp fields."""
        category = SymptomCategory.objects.first()
        assert category.created_at is not None
        assert category.updated_at is not None
