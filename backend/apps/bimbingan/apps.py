"""Bimbingan app — Phase 2: sessions, queue, calendar integration, scheduler."""
import os
import logging

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class BimbinganConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.bimbingan'
    verbose_name = 'Bimbingan'

    def ready(self):
        # Start background scheduler only in the main Django worker process.
        # Django's autoreloader spawns a child process with RUN_MAIN=true;
        # the outer watcher process should not start the scheduler.
        if os.environ.get('RUN_MAIN') == 'true' or not os.environ.get('RUN_MAIN'):
            # Only start if actually running server commands, not during migrations/tests
            import sys
            management_command = sys.argv[1] if len(sys.argv) > 1 else ''
            if management_command in ('runserver', 'gunicorn') or 'gunicorn' in sys.argv[0]:
                try:
                    from .scheduler import start_scheduler
                    start_scheduler()
                except Exception as e:
                    logger.exception("Gagal memulai scheduler: %s", e)
