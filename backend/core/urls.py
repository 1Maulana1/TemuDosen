"""URL patterns for the core app."""
from django.urls import path

from .views import csrf_cookie

urlpatterns = [
    path('csrf/', csrf_cookie, name='csrf-cookie'),
]
