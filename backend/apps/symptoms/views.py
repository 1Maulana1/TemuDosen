"""
SymptomCategory ViewSet — admin write / approved-user read + bulk_update action.

Permission matrix (D-05, RESEARCH Pattern 6, Threat T-1-11):
  - list, retrieve: IsApprovedUser (any authenticated + approved user)
  - create, update, partial_update, destroy: IsAdmin
  - bulk_update (custom action): IsAdmin

Bulk update (D-07): POST /api/symptoms/bulk-update/ updates many rows in one transaction.
"""
from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsAdmin, IsApprovedUser

from .models import SymptomCategory
from .serializers import BulkUpdateItemSerializer, SymptomCategorySerializer

# Actions that require admin-only access.
_ADMIN_WRITE_ACTIONS = {'create', 'update', 'partial_update', 'destroy', 'bulk_update'}


class SymptomCategoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for SymptomCategory CRUD + bulk-update.

    Read endpoints (list/retrieve): IsApprovedUser
    Write endpoints (create/update/partial_update/destroy): IsAdmin
    Bulk-update action: IsAdmin
    """

    queryset = SymptomCategory.objects.all()
    serializer_class = SymptomCategorySerializer

    def get_permissions(self):
        """
        Return appropriate permissions based on action (RESEARCH Pattern 6).

        Admin-only for all writes; IsApprovedUser for reads.
        """
        if self.action in _ADMIN_WRITE_ACTIONS:
            return [IsAdmin()]
        return [IsApprovedUser()]

    @action(detail=False, methods=['post'], url_path='bulk-update')
    def bulk_update(self, request):
        """
        POST /api/symptoms/bulk-update/

        Accepts a list of {id, name?, duration_minutes?, is_active?} objects.
        Updates all in a single atomic transaction (D-07: save all at once).

        Returns 200 with the updated list on success.
        Returns 400 if payload is empty, not a list, or any item has an invalid ID.
        """
        payload = request.data

        # Must be a non-empty list
        if not isinstance(payload, list) or len(payload) == 0:
            return Response(
                {'detail': 'Payload harus berupa daftar item yang tidak kosong.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate each item
        item_serializers = []
        for item in payload:
            ser = BulkUpdateItemSerializer(data=item)
            if not ser.is_valid():
                return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
            item_serializers.append(ser.validated_data)

        # Verify all IDs exist before touching the DB
        ids = [item['id'] for item in item_serializers]
        existing = SymptomCategory.objects.filter(pk__in=ids)
        existing_ids = set(existing.values_list('pk', flat=True))
        missing_ids = [pk for pk in ids if pk not in existing_ids]
        if missing_ids:
            return Response(
                {'detail': f'ID tidak ditemukan: {missing_ids}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Apply updates atomically
        with transaction.atomic():
            updated_objects = []
            for item_data in item_serializers:
                pk = item_data.pop('id')
                category = SymptomCategory.objects.get(pk=pk)
                for field, value in item_data.items():
                    setattr(category, field, value)
                category.save()
                updated_objects.append(category)

        # Return the updated list
        serializer = SymptomCategorySerializer(updated_objects, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
