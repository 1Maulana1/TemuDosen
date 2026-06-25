"""
URL configuration for the symptoms app.

Registered routes (via DefaultRouter):
  GET    /api/symptoms/              → SymptomCategoryViewSet.list
  POST   /api/symptoms/              → SymptomCategoryViewSet.create  (IsAdmin)
  GET    /api/symptoms/<id>/         → SymptomCategoryViewSet.retrieve
  PATCH  /api/symptoms/<id>/         → SymptomCategoryViewSet.partial_update  (IsAdmin)
  DELETE /api/symptoms/<id>/         → SymptomCategoryViewSet.destroy  (IsAdmin)
  POST   /api/symptoms/bulk-update/  → SymptomCategoryViewSet.bulk_update  (IsAdmin)
"""
from rest_framework.routers import DefaultRouter

from .views import SymptomCategoryViewSet

router = DefaultRouter()
router.register(r'', SymptomCategoryViewSet, basename='symptom-category')

urlpatterns = router.urls
