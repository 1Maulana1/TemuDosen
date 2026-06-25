"""
Submission filters — Plan 05 (REVIEW-01, D-11).

SubmissionFilter: django-filter FilterSet for the lecturer submission list.
Exposes:
  - status: exact match filter (pending / approved / rejected / revision)

Search and ordering are configured on the view via DRF filter backends:
  - SearchFilter: searches student__nim, student__full_name
  - OrderingFilter: orders by created_at (ascending/descending)

Per RESEARCH: "Don't Hand-Roll — django-filter" (Pattern table).
FilterSet is the canonical way to expose URL-param filtering in DRF.
"""
import django_filters

from .models import Submission


class SubmissionFilter(django_filters.FilterSet):
    """
    FilterSet for the lecturer submission list endpoint.

    Query params:
      ?status=pending|approved|rejected|revision  — exact status match (D-09)

    Search and ordering handled by DRF's SearchFilter + OrderingFilter on the view.
    """

    class Meta:
        model = Submission
        fields = {
            'status': ['exact'],
        }
