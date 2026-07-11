#!/bin/sh
# Start command produksi (Railway/Render): gunicorn + Celery worker dalam SATU
# container.
#
# Kenapa satu container? Railway tidak bisa share volume antar service, padahal
# worker STT harus membaca file rekaman yang ditulis web service (MEDIA_ROOT).
# Dengan provider STT 'groq' (default) worker sangat ringan — hanya HTTP call —
# jadi aman berbagi container dengan gunicorn di plan kecil.
#
# Worker hanya dinyalakan bila pipeline aktif; tanpa itu (atau tanpa
# CELERY_BROKER_URL) app tetap jalan normal — logbook jatuh ke catatan manual.
case "$STT_LLM_ENABLED" in
  [Tt]rue|1|[Yy]es|[Oo]n)
    if [ -n "$CELERY_BROKER_URL" ]; then
      echo "[start.sh] STT_LLM_ENABLED aktif — menyalakan Celery worker (queue stt,llm)"
      celery -A config worker --loglevel=info --concurrency=1 -Q stt,llm &
    else
      echo "[start.sh] PERINGATAN: STT_LLM_ENABLED aktif tapi CELERY_BROKER_URL kosong — worker tidak dinyalakan"
    fi
    ;;
esac

exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 2
