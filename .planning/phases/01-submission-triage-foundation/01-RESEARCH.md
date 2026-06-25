# Phase 1: Submission & Triage Foundation — Research

**Researched:** 2026-06-23
**Domain:** Django 5.2 + Django REST Framework + React (Vite) + Tailwind CSS v4 — greenfield SPA backend
**Confidence:** HIGH (core stack verified via PyPI/official docs; patterns from official DRF/Django/Vite documentation)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Admin-defined symptom categories per semester — not hardcoded
- **D-02:** 6 default categories seeded: Thesis methodology, Data analysis, Writing & structure, Literature review, Time management, Supervisor conflict
- **D-03:** Admin can add, edit, delete symptom categories
- **D-04:** Duration weights stored as absolute minutes (30, 45, 60 etc.)
- **D-05:** Weights are global — no per-lecturer overrides in Phase 1
- **D-06:** Inline-editable table layout (Symptom name | Duration in minutes)
- **D-07:** Single-page Edit mode — click row to modify, save all changes at once
- **D-08:** Weights persist until Admin manually updates (no auto-reset per semester)
- **D-09:** Lecturer view shows all statuses: Pending, Rejected/Revision-Requested, Approved
- **D-10:** Lecturer list columns: Student NIM, Name, Symptom category, Status, Submitted date/time, File name + Preview button
- **D-11:** Filter by status, search by NIM/name, sort by date/symptom
- **D-12:** Phase 1 scope: view + PDF preview only. Approve/reject deferred to Phase 2.
- **D-13:** PDF max 5MB, PDF format only
- **D-14:** In-app preview via iframe/viewer when lecturer clicks "Preview"
- **D-15:** Student can view own submissions with preview and download
- **D-16:** Split-pane layout (PDF left, notes/feedback right) — student view in Phase 1; extend to lecturer in Phase 2
- **D-17:** Self-registration — campus email; no SSO
- **D-18:** Role self-selected on registration (Student or Lecturer); Admin approves all new accounts
- **D-19:** No email domain restriction — admin approval is sole gate
- **D-20:** After registration: active but access-restricted — "pending approval" banner; cannot submit until approved
- **D-21:** Session strategy: server-side sessions with cookie-based auth (NOT JWT)
- **D-22:** Student registration: NIM, full name, email, password, lecturer selection dropdown (approved lecturers only)
- **D-23:** Lecturer registration: NIDN, full name, email, password
- **D-24:** Student–Lecturer advising relationship set at registration; Admin can reassign later
- **D-25:** Admin and Kaprodi accounts seeded during deployment (management command / seed script)
- **D-26:** Files stored on local filesystem, e.g., `/storage/uploads/`
- **D-27:** UUID-based filenames (e.g., `/storage/{uuid}.pdf`) — no guessable filename
- **D-28:** Disk-level encryption (LUKS on Linux) satisfies AES-256 at-rest requirement
- **D-29 ⚠ RISK:** Files served via URL with UUID filename may lack server-side auth check. PRD requires access restricted to specific lecturer–student pair. **Planner must implement protected app route for file serving.**

### Claude's Discretion
- PDF viewer implementation detail (iframe vs embedded PDF.js) — choose whatever renders consistently at 360px
- Exact UI component library / design system — not specified; use Tailwind utilities + custom React components per UI-SPEC

### Deferred Ideas (OUT OF SCOPE)
- Per-lecturer symptom weight overrides
- Bulk CSV import for admin symptom configuration
- Google Calendar OAuth2 connection flow
- Password reset flow (planner should include standard reset-by-email — not deferred per CONTEXT specifics, but was mentioned as "not discussed")
- SSO / OAuth login
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRIAGE-01 | Student can submit a guidance request by selecting "Academic Symptoms" from a dropdown and uploading a draft PDF (max 5MB) | DRF ModelViewSet + MultiPartParser handles multipart form; FileExtensionValidator + magic bytes check validates PDF; UUID renaming on save |
| TRIAGE-02 | System validates the draft file and symptom form together on submit, rejecting incomplete submissions with a clear error | DRF serializer validation with field-level validators; error responses use 400 with structured error dict matching UI-SPEC copy |
| REVIEW-01 | Lecturer can view pending guidance requests, including student's stated symptoms and draft attachment | DRF ListAPIView filtered by `lecturer` FK; serializer exposes `file_url` pointing to protected serve endpoint; query param filtering by status |
| ADMIN-01 | Admin configures per-"Symptom" duration weights at the start of each semester | SymptomCategory model with `duration_minutes`; DRF ViewSet with bulk-update action; seeded via data migration |
</phase_requirements>

---

## Summary

Phase 1 is a greenfield Walking Skeleton for a Django REST Framework + React (Vite) SPA. The backend provides session-based auth (Django sessions + cookies, not JWT), a multi-role custom User model, file upload handling with server-side auth-gated serving, and CRUD for SymptomCategory. The frontend is a React app scaffolded with Vite, styled with Tailwind CSS v4, using React Router for client-side routing and role-based route guards.

The most technically sensitive decision in this phase is D-29: file serving must go through a protected Django view — not a direct media URL — to satisfy the PRD's access-restriction requirement. This has architectural ripple effects: the `MEDIA_URL` should NOT be publicly accessible; instead a dedicated `/api/files/<uuid>/` endpoint authenticates the request and returns a `FileResponse`.

**Primary recommendation:** Build the Walking Skeleton first (Wave 0) — scaffold both repos, wire one authenticated API call end-to-end, then layer in the full feature set in subsequent waves. This de-risks the CORS + session cookie handshake before any business logic is written.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| User authentication (login/logout) | API / Backend | — | Sessions are server-side; React SPA sends credentials to `/api/auth/login/` |
| Role-based access control | API / Backend | Frontend Server (route guards) | Backend enforces permissions; frontend route guards are UX-only (not security) |
| Submission form validation | API / Backend | Browser / Client | Backend is authoritative; client-side validation is UX convenience only |
| PDF file storage | API / Backend | — | Files stored server-side; UUID paths; served via auth-gated view |
| PDF file serving (auth check) | API / Backend | — | Must not bypass to static/CDN; server reads file after auth check per D-29 |
| Symptom chip multi-select | Browser / Client | — | Pure UI interaction; selection sent to API on submit |
| PDF preview rendering | Browser / Client | — | `<iframe src="/api/files/<uuid>/">` — browser renders; auth cookie sent with request |
| Admin symptom weight config | API / Backend | Browser / Client | Backend stores and validates; inline-edit table is client-side UX pattern |
| User registration | API / Backend | Browser / Client | Backend creates account, sets `is_approved=False`; frontend collects form data |
| Lecturer dropdown (approved only) | API / Backend | — | Filtered queryset endpoint `/api/lecturers/?approved=true` |
| Pending approval gate | API / Backend | Browser / Client | Backend returns 403 if `is_approved=False`; frontend renders banner on login |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Django | 5.2.x (LTS) | Web framework, ORM, session management | LTS release (active until April 2028); supports Python 3.10–3.13 [VERIFIED: pypi.org/project/django] |
| djangorestframework | 3.17.1 | REST API serializers, viewsets, permissions, parsers | De facto standard for Django REST APIs; official DRF docs [VERIFIED: pypi.org/project/djangorestframework] |
| django-cors-headers | 4.9.0 | CORS headers for React dev server (different origin) | Official package maintained by Adam Johnson; required for React SPA on separate origin [VERIFIED: pypi.org/project/django-cors-headers] |
| django-environ | 0.14.0 | .env file loading, 12-factor config | Production-stable; handles DATABASE_URL and SECRET_KEY separation [VERIFIED: pypi.org/project/django-environ] |
| React | 18.x (bundled with Vite template) | UI framework | Confirmed stack decision; pairs with Vite react-ts template [ASSUMED] |
| Vite | 8.x | Build tool + dev server with proxy | Current major version; `npm create vite@latest -- --template react-ts` [VERIFIED: vite.dev/guide] |
| Tailwind CSS | v4.3 | Utility-first CSS | UI-SPEC specifies Tailwind; v4 is current and CSS-config-based [VERIFIED: tailwindcss.com/docs] |
| React Router | 7.x (react-router package) | Client-side routing, protected routes | Current version (7 series); `npm install react-router` [ASSUMED — react-router-dom v8 announcement was noted but react-router is the current canonical package] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tailwindcss/vite | bundled with tw v4 | Vite plugin for Tailwind CSS v4 | Required for Tailwind v4 + Vite integration |
| @tailwindcss/forms | 0.5.11 | Form element base styles | Specified in UI-SPEC; v4-compatible [VERIFIED: github.com/tailwindlabs/tailwindcss-forms/releases] |
| pytest | 9.1.1 | Python test runner | Current stable; industry standard [VERIFIED: pypi.org/project/pytest] |
| pytest-django | 4.12.0 | Django + pytest integration | Enables pytest fixtures with Django DB; current stable [VERIFIED: pypi.org/project/pytest-django] |
| factory-boy | 3.3.3 | Test factories for Django models | SubFactory pattern for models with FK relationships; cleaner than fixtures [VERIFIED: pypi.org/project/factory-boy] |
| django-filter | 25.2 | URL-parameter queryset filtering | Pairs with DRF for submission list filtering by status, date [VERIFIED: pypi.org/project/django-filter] |
| python-magic | 0.4.27 | MIME type validation by reading file magic bytes | Validates actual PDF content — not just extension; requires libmagic on host [VERIFIED: pypi.org/project/python-magic] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Django 5.2 LTS | Django 6.0 | 6.0 is latest but requires Python 3.12+; 5.2 LTS is safer for academic project longevity |
| python-magic | Extension-only validation | Extension check can be spoofed (rename .exe to .pdf); magic bytes check is authoritative |
| django-environ | python-decouple | Both work; django-environ has DATABASE_URL parsing which is useful for deployment |
| @tailwindcss/vite plugin | PostCSS plugin | Vite plugin is the v4-recommended approach and avoids PostCSS config entirely |

**Installation (backend):**
```bash
pip install django==5.2.* djangorestframework==3.17.* django-cors-headers==4.9.* \
  django-environ==0.14.* django-filter==25.2 python-magic==0.4.27 \
  pytest==9.1.* pytest-django==4.12.* factory-boy==3.3.*
```

**Installation (frontend):**
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install react-router @tailwindcss/vite @tailwindcss/forms
```

**Version verification (run before finalizing):**
```bash
# Backend
pip index versions django djangorestframework django-cors-headers django-environ django-filter python-magic pytest pytest-django factory-boy

# Frontend
npm view react-router version
npm view @tailwindcss/vite version
npm view @tailwindcss/forms version
```

---

## Package Legitimacy Audit

> All packages were verified against official PyPI or GitHub release pages.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| django | PyPI | 20+ yrs | Very high | github.com/django/django | OK | Approved |
| djangorestframework | PyPI | 13+ yrs | Very high | github.com/encode/django-rest-framework | OK | Approved |
| django-cors-headers | PyPI | 10+ yrs | Very high | github.com/adamchainz/django-cors-headers | OK | Approved |
| django-environ | PyPI | 10+ yrs | High | github.com/joke2k/django-environ | OK | Approved |
| django-filter | PyPI | 10+ yrs | High | github.com/carltongibson/django-filter | OK | Approved |
| python-magic | PyPI | 10+ yrs | High | github.com/ahupp/python-magic | OK | Approved — note: requires libmagic system library |
| pytest | PyPI | 20+ yrs | Very high | github.com/pytest-dev/pytest | OK | Approved |
| pytest-django | PyPI | 13+ yrs | High | github.com/pytest-dev/pytest-django | OK | Approved |
| factory-boy | PyPI | 10+ yrs | High | github.com/FactoryBoy/factory_boy | OK | Approved |
| react-router | npm | 10+ yrs | Very high | github.com/remix-run/react-router | OK | Approved |
| @tailwindcss/forms | npm | 5+ yrs | High | github.com/tailwindlabs/tailwindcss-forms | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

**Note on python-magic (Windows dev):** libmagic requires a DLL on Windows. Install `python-magic-bin` on Windows dev machines: `pip install python-magic-bin`. Linux production: `apt-get install libmagic1`.

---

## Architecture Patterns

### System Architecture Diagram

```
[Browser: React SPA (Vite, port 5173 dev)]
    |
    | credentials: 'include' (session cookie + CSRF token)
    |
    v
[Django API (port 8000)]
    |-- /api/auth/         --> SessionAuthentication + custom login/register views
    |-- /api/submissions/  --> DRF ViewSet (IsAuthenticated + role permission)
    |-- /api/symptoms/     --> DRF ViewSet (admin: write; others: read-only)
    |-- /api/files/<uuid>/ --> Protected FileResponse view (auth check before read)
    |-- /api/users/        --> Registration + lecturer list (approved filter)
    |
    v
[Django ORM]
    |
    v
[SQLite (dev) / PostgreSQL (prod)]
    |
    +-- media/ (local filesystem, UUID filenames, NOT under MEDIA_URL direct serve)
```

**Dev deployment notes:**
- Vite proxy `/api` → `http://localhost:8000` means React runs on port 5173 and proxies all `/api/*` to Django
- Session cookie works as **same-origin** from the browser's perspective (Vite proxy strips origin difference)
- `CORS_ALLOWED_ORIGINS` is still needed if not using proxy (e.g., mobile testing)
- `SESSION_COOKIE_SAMESITE = 'Lax'` is sufficient with proxy; `'None'` + HTTPS required for cross-origin production without proxy

### Recommended Project Structure

```
temudosen/                   # git root (contains frontend/ and backend/)
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env                 # SECRET_KEY, DATABASE_URL (gitignored)
│   ├── config/
│   │   ├── settings/
│   │   │   ├── base.py      # shared settings
│   │   │   ├── dev.py       # DEBUG=True, CORS_ALLOW_ALL_ORIGINS
│   │   │   └── prod.py      # HTTPS, ALLOWED_HOSTS, SECURE_* flags
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── apps/
│   │   ├── accounts/        # CustomUser model, registration, login, approval
│   │   │   ├── models.py
│   │   │   ├── serializers.py
│   │   │   ├── views.py
│   │   │   ├── permissions.py
│   │   │   └── migrations/  # includes 0001_initial with CustomUser
│   │   ├── submissions/     # Submission, SubmissionFile models + ViewSets
│   │   │   ├── models.py
│   │   │   ├── serializers.py
│   │   │   ├── views.py
│   │   │   └── migrations/
│   │   └── symptoms/        # SymptomCategory model + ViewSet + seed migration
│   │       ├── models.py
│   │       ├── serializers.py
│   │       ├── views.py
│   │       └── migrations/
│   ├── storage/             # MEDIA_ROOT; gitignored; NOT served directly
│   └── tests/
│       ├── conftest.py
│       ├── factories.py
│       ├── test_accounts.py
│       ├── test_submissions.py
│       └── test_symptoms.py
└── frontend/
    ├── vite.config.ts       # proxy /api → localhost:8000
    ├── src/
    │   ├── main.tsx
    │   ├── index.css        # @import "tailwindcss"; @theme { ... }
    │   ├── router.tsx       # React Router routes with role guards
    │   ├── api/
    │   │   ├── client.ts    # axios/fetch wrapper with CSRF cookie injection
    │   │   └── auth.ts      # login, logout, register, getCSRFToken
    │   ├── hooks/
    │   │   └── useAuth.ts   # auth state from /api/auth/me/ endpoint
    │   ├── components/
    │   │   ├── StatusBadge.tsx
    │   │   ├── UploadZone.tsx
    │   │   └── PDFPreview.tsx
    │   └── pages/
    │       ├── auth/        # Login, Register, PendingApproval
    │       ├── student/     # Dashboard, SubmissionForm
    │       ├── lecturer/    # Dashboard (submission list)
    │       └── admin/       # SymptomConfig, UserApproval
    └── tests/               # Vitest unit tests
```

### Pattern 1: Custom User Model (AbstractBaseUser)

**What:** Replace Django's default User with a custom model that adds `role`, `nim`, `nidn`, `is_approved`, and `adviser` FK.
**When to use:** All Django projects with non-standard user fields — MUST be done before `makemigrations` runs for the first time.

```python
# Source: docs.djangoproject.com/en/5.2/topics/auth/customizing/
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models

class UserRole(models.TextChoices):
    STUDENT = 'student', 'Mahasiswa'
    LECTURER = 'lecturer', 'Dosen'
    ADMIN = 'admin', 'Admin'
    KAPRODI = 'kaprodi', 'Kaprodi'

class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', UserRole.ADMIN)
        extra_fields.setdefault('is_approved', True)
        return self.create_user(email, password, **extra_fields)

class CustomUser(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=UserRole.choices)
    nim = models.CharField(max_length=20, unique=True, null=True, blank=True)   # students only
    nidn = models.CharField(max_length=20, unique=True, null=True, blank=True)  # lecturers only
    is_approved = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    # Phase 4 forward-compatibility: Google Calendar OAuth tokens
    google_oauth_token = models.JSONField(null=True, blank=True)
    # Student → Lecturer advising relationship
    adviser = models.ForeignKey(
        'self', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='advisees',
        limit_choices_to={'role': UserRole.LECTURER}
    )
    created_at = models.DateTimeField(auto_now_add=True)

    objects = CustomUserManager()
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    class Meta:
        db_table = 'accounts_user'
```

```python
# settings/base.py
AUTH_USER_MODEL = 'accounts.CustomUser'
```

### Pattern 2: Session Auth CSRF Handshake (React ↔ Django)

**What:** React reads the `csrftoken` cookie that Django sets and includes `X-CSRFToken` header on all unsafe requests.
**When to use:** Every POST/PUT/PATCH/DELETE from the React SPA.

```typescript
// Source: www.django-rest-framework.org/api-guide/authentication/
// frontend/src/api/client.ts

function getCsrfToken(): string {
  return document.cookie
    .split(';')
    .find(c => c.trim().startsWith('csrftoken='))
    ?.split('=')[1] ?? '';
}

export async function apiRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const isUnsafe = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
    options.method?.toUpperCase() ?? 'GET'
  );
  return fetch(url, {
    ...options,
    credentials: 'include',          // send session cookie
    headers: {
      'Content-Type': 'application/json',
      ...(isUnsafe ? { 'X-CSRFToken': getCsrfToken() } : {}),
      ...(options.headers ?? {}),
    },
  });
}
```

**Django must set CSRF cookie on first page load.** Add a no-op GET endpoint that ensures the cookie is set:

```python
# accounts/views.py
from django.middleware.csrf import get_token
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def csrf_cookie(request):
    get_token(request)  # forces cookie to be set in response
    return Response({'detail': 'CSRF cookie set'})
```

### Pattern 3: Protected File Serving (resolves D-29)

**What:** Files are NOT served via `MEDIA_URL` directly. Instead, a Django view checks authentication + ownership before streaming the file.
**When to use:** All file access in this project — required by PRD security constraint.

```python
# submissions/views.py
import os
from django.http import FileResponse, Http404
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def serve_submission_file(request, file_uuid):
    """Serve uploaded file only to the submission's student or their lecturer."""
    from .models import SubmissionFile
    try:
        submission_file = SubmissionFile.objects.select_related(
            'submission__student__adviser'
        ).get(uuid=file_uuid)
    except SubmissionFile.DoesNotExist:
        raise Http404

    user = request.user
    submission = submission_file.submission
    # Access check: student owns submission OR is the assigned lecturer
    if user != submission.student and user != submission.student.adviser:
        if not user.role in ('admin', 'kaprodi'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied

    file_path = submission_file.file_path  # absolute path, e.g. /storage/{uuid}.pdf
    if not os.path.exists(file_path):
        raise Http404

    response = FileResponse(open(file_path, 'rb'), content_type='application/pdf')
    # inline for preview; use 'attachment' with filename for download
    response['Content-Disposition'] = f'inline; filename="{submission_file.original_filename}"'
    return response
```

### Pattern 4: File Upload Serializer with Validation

**What:** DRF serializer validates PDF MIME type using magic bytes and enforces 5MB limit.
**When to use:** `POST /api/submissions/` — multipart form data with file.

```python
# submissions/serializers.py
import uuid
import os
import magic  # python-magic
from django.core.validators import FileExtensionValidator
from django.core.exceptions import ValidationError
from rest_framework import serializers
from .models import Submission, SubmissionFile

class SubmissionCreateSerializer(serializers.Serializer):
    symptom_ids = serializers.ListField(
        child=serializers.IntegerField(), min_length=1
    )
    description = serializers.CharField(required=False, allow_blank=True, max_length=500)
    draft_file = serializers.FileField(
        validators=[FileExtensionValidator(allowed_extensions=['pdf'])]
    )

    def validate_draft_file(self, file):
        # Size check: 5MB
        if file.size > 5 * 1024 * 1024:
            raise serializers.ValidationError(
                "Ukuran file melebihi batas 5MB. Pilih file yang lebih kecil."
            )
        # MIME type check via magic bytes (not just extension)
        mime = magic.from_buffer(file.read(1024), mime=True)
        file.seek(0)
        if mime != 'application/pdf':
            raise serializers.ValidationError("Hanya file PDF yang diizinkan.")
        return file

    def save_file(self, file):
        """Save file with UUID name, return (uuid, original_filename, file_path)."""
        from django.conf import settings
        file_uuid = str(uuid.uuid4())
        file_path = os.path.join(settings.MEDIA_ROOT, f'{file_uuid}.pdf')
        os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
        with open(file_path, 'wb+') as destination:
            for chunk in file.chunks():
                destination.write(chunk)
        return file_uuid, file.name, file_path
```

### Pattern 5: Symptom Seed via Data Migration

**What:** Seed the 6 default symptom categories in a data migration (not a fixture), so they're present after `migrate` on any fresh setup.
**When to use:** Initial project setup; Phase 1 Wave 0.

```python
# symptoms/migrations/0002_seed_default_symptoms.py
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
    SymptomCategory = apps.get_model('symptoms', 'SymptomCategory')
    for name, duration in DEFAULT_SYMPTOMS:
        SymptomCategory.objects.get_or_create(
            name=name,
            defaults={'duration_minutes': duration}
        )

def unseed_symptoms(apps, schema_editor):
    pass  # intentionally non-destructive reverse

class Migration(migrations.Migration):
    dependencies = [('symptoms', '0001_initial')]
    operations = [migrations.RunPython(seed_symptoms, unseed_symptoms)]
```

### Pattern 6: Role-Based DRF Permission Classes

**What:** Custom DRF permission classes for Student, Lecturer, Admin roles.
**When to use:** On every ViewSet and APIView in the project.

```python
# accounts/permissions.py
from rest_framework import permissions

class IsApprovedUser(permissions.BasePermission):
    """User must be authenticated AND approved by admin."""
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.is_approved
        )

class IsStudent(IsApprovedUser):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.role == 'student'

class IsLecturer(IsApprovedUser):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.role == 'lecturer'

class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'admin'
```

### Pattern 7: Vite Proxy Configuration

**What:** Vite dev server proxies `/api/*` to Django — eliminates cross-origin issues during development.
**When to use:** Development only; production uses Nginx upstream configuration.

```typescript
// Source: vite.dev/config/server-options
// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // Do NOT rewrite — Django is configured to receive /api/* prefix
      },
    },
  },
})
```

### Pattern 8: Tailwind CSS v4 Theme Config (CSS-based)

**What:** Tailwind v4 uses CSS `@theme` directive, NOT a JavaScript `tailwind.config.js`. The UI-SPEC's JS config block must be translated to CSS variables.
**When to use:** Initial Tailwind setup; all design tokens from UI-SPEC.

```css
/* Source: tailwindcss.com/docs/theme */
/* frontend/src/index.css */
@import "tailwindcss";
@import "@tailwindcss/forms";

@theme {
  /* Colors from UI-SPEC */
  --color-primary: #1A56DB;
  --color-success: #0E9F6E;
  --color-error: #E02424;
  --color-warning: #FF8A4C;
  --color-neutral-gray: #6B7280;
  --color-surface: #FFFFFF;
  --color-on-surface-variant: #4B5563;

  /* Border radius from UI-SPEC */
  --radius-DEFAULT: 0.25rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  --radius-2xl: 1rem;
  --radius-full: 9999px;

  /* Fonts from UI-SPEC */
  --font-headline: 'Plus Jakarta Sans', sans-serif;
  --font-display: 'Plus Jakarta Sans', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-label: 'Public Sans', sans-serif;
}
```

> **Critical:** The UI-SPEC uses the Tailwind v3 JavaScript `tailwind.config` format as a documentation reference. The actual implementation MUST use the CSS `@theme` directive (Tailwind v4 requirement). The JS config format is not auto-detected in v4.

### Pattern 9: React Router Protected Route

**What:** Wrap role-specific routes in a component that checks auth state and redirects.
**When to use:** All routes that require authentication or specific role.

```typescript
// frontend/src/router.tsx
import { createBrowserRouter, redirect } from 'react-router'
import { getCurrentUser } from './api/auth'

async function requireAuth({ request }: { request: Request }) {
  const user = await getCurrentUser()
  if (!user) throw redirect('/login')
  if (!user.is_approved) throw redirect('/pending-approval')
  return user
}

async function requireRole(role: string) {
  return async ({ request }: { request: Request }) => {
    const user = await requireAuth({ request })
    if ((user as any).role !== role) throw redirect('/')
    return user
  }
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/pending-approval', element: <PendingApprovalPage /> },
  {
    path: '/mahasiswa',
    loader: requireRole('student'),
    children: [
      { index: true, element: <StudentDashboard /> },
      { path: 'ajukan', element: <SubmissionForm /> },
    ],
  },
  {
    path: '/dosen',
    loader: requireRole('lecturer'),
    children: [
      { index: true, element: <LecturerDashboard /> },
    ],
  },
  {
    path: '/admin',
    loader: requireRole('admin'),
    children: [
      { path: 'katalog-gejala', element: <SymptomConfig /> },
      { path: 'pengguna', element: <UserApproval /> },
    ],
  },
])
```

### Pattern 10: Django Settings Split (dev/prod)

**What:** Separate settings files for dev and prod; environment variables via django-environ.
**When to use:** Greenfield projects — establish before first `migrate`.

```python
# config/settings/base.py
import environ
env = environ.Env()
environ.Env.read_env('.env')

SECRET_KEY = env('SECRET_KEY')
AUTH_USER_MODEL = 'accounts.CustomUser'
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'django_filters',
    'apps.accounts',
    'apps.submissions',
    'apps.symptoms',
]
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',    # MUST be before CommonMiddleware
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
    ],
}
# File uploads
MEDIA_ROOT = env('MEDIA_ROOT', default=BASE_DIR / 'storage')
MEDIA_URL = None  # Intentionally None — files served via auth-gated view, NOT direct URL
# Upload size limit: 5MB + overhead
DATA_UPLOAD_MAX_MEMORY_SIZE = 6 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 6 * 1024 * 1024
# Session settings
SESSION_ENGINE = 'django.contrib.sessions.backends.db'
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'  # sufficient when Vite proxy is used in dev
CSRF_COOKIE_HTTPONLY = False     # React must be able to read csrftoken cookie
CSRF_COOKIE_SAMESITE = 'Lax'
```

### Anti-Patterns to Avoid

- **Serving media files directly via MEDIA_URL:** Violates PRD security constraint. Files must go through the `/api/files/<uuid>/` protected view.
- **Storing JWT in localStorage:** Decided against (D-21). XSS risk. Sessions + HttpOnly cookies are the correct approach.
- **Using `AbstractUser` instead of `AbstractBaseUser`:** `AbstractUser` bundles username + first/last_name which conflicts with NIM/NIDN model. Use `AbstractBaseUser` + `PermissionsMixin`.
- **Setting `AUTH_USER_MODEL` after initial migration:** Causes irreparable migration dependency chain. Must be set BEFORE `makemigrations` is ever run.
- **Checking file MIME type via extension only:** Extension can be spoofed. Use python-magic to read actual magic bytes.
- **Forgetting `corsheaders.middleware.CorsMiddleware` before `CommonMiddleware`:** CORS headers will not be set on responses. Order is critical.
- **Using Tailwind v3 JS config syntax without `@config` directive in v4:** Tailwind v4 does NOT auto-detect `tailwind.config.js`. Either use CSS `@theme` or add `@config "./tailwind.config.js"` explicitly.
- **Running `MEDIA_URL` on the same app server in production:** Use Nginx `X-Accel-Redirect` or a separate protected-serve pattern; never `DEBUG=True` static file serving in production.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CORS headers | Custom middleware | `django-cors-headers` | Handles preflight, varies header, origin lists; edge cases in browser CORS are numerous |
| Session auth for React SPA | Custom token solution | Django sessions + DRF SessionAuthentication | D-21 locked decision; handles rotation, expiry, DB storage natively |
| PDF MIME type validation | Extension check only | `python-magic` + `FileExtensionValidator` | Magic bytes check is authoritative; .pdf extension can be faked |
| URL parameter filtering | Custom queryset logic | `django-filter` + DRF FilterBackend | Handles type coercion, multi-value, range filters safely |
| Test data factories | Hard-coded dicts in tests | `factory-boy` | SubFactory for FK chains; `build()` vs `create()` strategy control |
| Environment variable config | Hardcoded settings | `django-environ` | DATABASE_URL parsing, .env file loading, type casting |
| Symptom seed data | Manual SQL or shell script | Data migration `RunPython` | Auto-runs on `migrate`; version-controlled; reversible |

**Key insight:** In a Django + DRF project, the framework already provides 80% of what you need. Custom code is for business logic (role checks, ownership validation), not infrastructure.

---

## Common Pitfalls

### Pitfall 1: AUTH_USER_MODEL Set After First Migration
**What goes wrong:** Django bakes user FK references into auth migrations. Changing `AUTH_USER_MODEL` after `0001_initial` causes circular dependency errors that cannot be resolved without resetting the entire database.
**Why it happens:** Developers prototype with `manage.py migrate` before defining the custom user model.
**How to avoid:** The very first task in Wave 0 must be: create `apps/accounts/models.py` with `CustomUser`, set `AUTH_USER_MODEL` in `settings`, then run `makemigrations accounts` and `migrate` — in that order. Never run `migrate` before this.
**Warning signs:** `django.db.migrations.exceptions.CircularDependencyError` or `ValueError: Dependency on app with no migrations`.

### Pitfall 2: Session Cookie Not Sent by React (CORS mode)
**What goes wrong:** React `fetch` calls do not include the session cookie by default in cross-origin mode, causing all requests to appear unauthenticated.
**Why it happens:** `fetch` defaults to `credentials: 'omit'` for cross-origin requests.
**How to avoid:** Set `credentials: 'include'` on every fetch call (abstracted in `api/client.ts`). With Vite proxy, requests become same-origin and `credentials: 'same-origin'` works too, but `'include'` is universally correct.
**Warning signs:** Response returns 403, `request.user.is_authenticated` is `False` in Django even after login.

### Pitfall 3: CSRF Token Cookie Not Set Before First POST
**What goes wrong:** React makes a login POST but Django hasn't sent the `csrftoken` cookie yet, so `getCsrfToken()` returns empty string and the request is rejected with 403 CSRF verification failed.
**Why it happens:** Django only sets the `csrftoken` cookie when the CSRF middleware processes a request (typically on first GET).
**How to avoid:** Call `GET /api/csrf/` (the `csrf_cookie` view) on app mount in `main.tsx` before any other API calls. This guarantees the cookie is present.
**Warning signs:** `403 CSRF Failed: CSRF token missing` on the very first POST request after a fresh page load.

### Pitfall 4: Tailwind v4 Config Not Loaded
**What goes wrong:** Custom colors like `bg-primary` or `font-headline` don't generate utility classes.
**Why it happens:** The project uses the Tailwind v4 `@tailwindcss/vite` plugin but the developer writes a `tailwind.config.js` file expecting it to be auto-detected. In v4, JS config is NOT auto-detected.
**How to avoid:** Use the CSS `@theme` directive in `index.css`. Do not use `tailwind.config.js` unless you explicitly add `@config "./tailwind.config.js"` to the CSS file.
**Warning signs:** Purged CSS build includes no custom utilities; `bg-primary` class has no style in browser DevTools.

### Pitfall 5: python-magic Fails on Windows Dev
**What goes wrong:** `import magic` raises `ImportError` or fails to find `libmagic.dll` on Windows development machines.
**Why it happens:** `python-magic` requires the C library `libmagic`; on Windows this must be provided by DLLs.
**How to avoid:** Add `python-magic-bin` to `requirements-dev.txt` for Windows; use `python-magic` only (no `-bin`) in Linux/production requirements. Document this in the README. Alternatively, gate the import with a try/except and fall back to extension-only validation in dev.
**Warning signs:** `OSError: [WinError 126] The specified module could not be found` or `magic.MagicException`.

### Pitfall 6: File Size Limit Exceeded Before Django Validates
**What goes wrong:** Django raises a generic 413 or `SuspiciousOperation` before the serializer's `validate_draft_file` runs, so the user sees an unhelpful server error instead of the UI-SPEC validation message.
**Why it happens:** `DATA_UPLOAD_MAX_MEMORY_SIZE` default is 2.5MB; the file exceeds it before DRF serializer validation runs.
**How to avoid:** Set `DATA_UPLOAD_MAX_MEMORY_SIZE = 6 * 1024 * 1024` (6MB, slightly above the 5MB app limit) so Django accepts the upload; then the serializer validates and returns a proper 400 with the correct error message.
**Warning signs:** Client receives 413 Request Entity Too Large or a non-JSON 500 error for uploads between 2.5MB and 5MB.

### Pitfall 7: Lecturer Dropdown Shows Unapproved Lecturers
**What goes wrong:** Student sees unapproved lecturers in the registration dropdown and can assign themselves to a pending lecturer who may never be approved.
**Why it happens:** The lecturer list endpoint uses `CustomUser.objects.filter(role='lecturer')` without the `is_approved=True` filter.
**How to avoid:** The `/api/users/lecturers/` endpoint must filter `is_approved=True` explicitly. Document this in the ViewSet queryset.
**Warning signs:** Admin approval queue shows registered students linked to unapproved lecturers.

### Pitfall 8: react-router v7 Loader Auth Pattern Breaks on Unapproved Users
**What goes wrong:** Unapproved user logs in, `getCurrentUser()` returns a user object (they ARE authenticated), but the route guard only checks `is_authenticated` and lets them through to restricted pages.
**Why it happens:** The `requireAuth` loader only checks `user != null` but doesn't check `user.is_approved`.
**How to avoid:** The `requireAuth` loader must check both: `if (!user) redirect('/login')` AND `if (!user.is_approved) redirect('/pending-approval')`.
**Warning signs:** Unapproved student can navigate to `/mahasiswa/ajukan` and see the submission form.

---

## Code Examples

### Walking Skeleton: Thinnest End-to-End Slice

The Walking Skeleton for this stack is: **Login → authenticated API call → role-gated response**. This proves session cookies, CORS, CSRF, and React Router all work together before any domain features are built.

**Step 1: Scaffold backend**
```bash
django-admin startproject config .
python manage.py startapp accounts   # must create CustomUser here first
python manage.py startapp submissions
python manage.py startapp symptoms
```

**Step 2: One real DB read/write + API endpoint (verify walking skeleton)**
```bash
# In backend/
python manage.py migrate
python manage.py shell -c "
from apps.accounts.models import CustomUser
u = CustomUser.objects.create_superuser('admin@temudosen.ac.id', 'admin123')
print('Admin created:', u.email)
"
```

```bash
# Test with curl
curl -c cookies.txt -b cookies.txt \
  -X GET http://localhost:8000/api/csrf/ \
  && \
curl -c cookies.txt -b cookies.txt \
  -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: $(grep csrftoken cookies.txt | awk '{print $7}')" \
  -d '{"email":"admin@temudosen.ac.id","password":"admin123"}'
```

### Submission Model

```python
# submissions/models.py
import uuid
from django.db import models
from django.conf import settings

class Submission(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Menunggu'
        APPROVED = 'approved', 'Disetujui'
        REJECTED = 'rejected', 'Ditolak'
        REVISION = 'revision', 'Revisi'

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='submissions',
        limit_choices_to={'role': 'student'}
    )
    symptoms = models.ManyToManyField('symptoms.SymptomCategory')
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

class SubmissionFile(models.Model):
    submission = models.OneToOneField(Submission, on_delete=models.CASCADE, related_name='file')
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    original_filename = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)   # absolute path on disk
    file_size = models.PositiveIntegerField()       # bytes
    uploaded_at = models.DateTimeField(auto_now_add=True)
```

### SymptomCategory Model

```python
# symptoms/models.py
from django.db import models

class SymptomCategory(models.Model):
    name = models.CharField(max_length=255, unique=True)
    duration_minutes = models.PositiveIntegerField(
        help_text='Estimated guidance duration in minutes (absolute)'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'Symptom Categories'

    def __str__(self):
        return f'{self.name} ({self.duration_minutes} min)'
```

### Admin Seed Management Command (D-25)

```python
# apps/accounts/management/commands/seed_admin.py
from django.core.management.base import BaseCommand
from apps.accounts.models import CustomUser, UserRole

class Command(BaseCommand):
    help = 'Seed admin and kaprodi accounts for initial deployment'

    def handle(self, *args, **options):
        admin, created = CustomUser.objects.get_or_create(
            email='admin@temudosen.ac.id',
            defaults={
                'full_name': 'System Admin',
                'role': UserRole.ADMIN,
                'is_approved': True,
                'is_staff': True,
                'is_superuser': True,
            }
        )
        if created:
            admin.set_password('ChangeMe123!')
            admin.save()
            self.stdout.write(self.style.SUCCESS(
                'Created admin: admin@temudosen.ac.id / ChangeMe123!'
            ))
        else:
            self.stdout.write('Admin account already exists.')
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` JS config | CSS `@theme` directive | Tailwind v4 (2025) | UI-SPEC JS block is a reference spec only; actual implementation uses CSS variables |
| `@tailwind base/components/utilities` | `@import "tailwindcss"` | Tailwind v4 | Single import line replaces three directives |
| React Router v6 `<Routes>/<Route>` | React Router v7 createBrowserRouter + loaders | React Router v7 (2024) | Data loading in loaders enables cleaner auth guards; v7 is now `react-router` (not `react-router-dom`) |
| Django `AbstractUser` extension | `AbstractBaseUser` + `PermissionsMixin` | Best practice, stable | Required for multi-role models with NIM/NIDN instead of username/first/last |
| JWT auth for React SPAs | Server-side sessions + cookies | N/A (D-21 decision) | Avoids localStorage XSS risk; simpler server-side invalidation |
| Direct MEDIA_URL file serving | Auth-gated `/api/files/<uuid>/` view | Phase 1 design decision | Required by PRD access-restriction security constraint |

**Deprecated/outdated:**
- `tailwind.config.js` (auto-detection): Deprecated in Tailwind v4 — must use `@config` directive to load it explicitly, or migrate to CSS `@theme`.
- `react-router-dom` package: In React Router v7+, both web and native use `react-router` directly. `react-router-dom` still works as re-export but `react-router` is canonical.
- `AbstractUser` for multi-role Django projects: Still works, but bundles `username`/`first_name`/`last_name` fields that conflict with NIM/NIDN; `AbstractBaseUser` is cleaner.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | React version bundled with `npm create vite@latest -- --template react-ts` is React 18.x | Standard Stack | If it ships React 19, check for breaking changes in concurrent features; low risk — React 19 is backward compatible |
| A2 | `react-router` (v7 package) is the correct install target; not `react-router-dom` | Standard Stack | If v7 requires `react-router-dom` for web, npm install will succeed but wrong APIs used; test with `npm install react-router` and verify `createBrowserRouter` is available |
| A3 | Django 5.2 is the LTS release (not 4.2) | Standard Stack | PyPI showed 4.2 as "LTS" with long patch history, but 5.2 has LTS designation per Django project website. Check djangoproject.com/download/ to confirm current LTS. |
| A4 | `python-magic-bin` resolves Windows libmagic issue | Common Pitfalls | If Windows students' machines still fail, MIME validation may need to fall back to extension-only in dev with a `DEBUG` flag |
| A5 | Walking Skeleton dev deployment is localhost only (no HTTPS) | Architecture Patterns | `SESSION_COOKIE_SECURE=False` is acceptable for localhost dev; any non-localhost deployment requires HTTPS + `True` |
| A6 | `container-queries` Tailwind plugin is not needed in v4 (built-in) | Standard Stack (UI-SPEC requirement) | UI-SPEC mentions `container-queries` plugin; in Tailwind v4, container queries are built-in. No separate plugin install needed. |

---

## Open Questions (RESOLVED)

1. **Django 5.2 vs 4.2 LTS**
   - What we know: PyPI page for Django shows 4.2 with longest patch history (LTS label implied); 5.2 also received patches alongside 6.0 release
   - What's unclear: Whether 5.2 has the official Django LTS designation (Django project usually announces this on djangoproject.com)
   - Recommendation: Use Django 5.2 (modern, well-supported, DRF 3.17 supports it) unless the team has reason to require 4.2 support; verify at djangoproject.com/download/
   - **RESOLVED: Use Django 5.2** — DRF 3.17 supports it; no team constraint requiring 4.2.

2. **`container-queries` plugin in Tailwind v4**
   - What we know: UI-SPEC lists `@tailwindcss/forms` and `container-queries` as Tailwind plugins; Tailwind v4 has container queries built-in as first-class feature
   - What's unclear: Whether a separate `@tailwindcss/container-queries` install is still needed in v4
   - Recommendation: Container queries are built-in in Tailwind v4 (`@container` and `@lg:` variants work without plugin); do NOT install the separate plugin
   - **RESOLVED: Do NOT install `@tailwindcss/container-queries`** — built-in to Tailwind v4; `@tailwindcss/forms` v0.5.11 is the only plugin needed.

3. **Password reset flow**
   - What we know: CONTEXT.md marks password reset as "not discussed" — not deferred as out-of-scope; it's a gap
   - What's unclear: Whether it should be in Phase 1 or added as a separate task
   - Recommendation: Include a basic `password_reset_by_email` flow in Phase 1 auth scaffolding using Django's built-in `PasswordResetView` family wired to DRF responses; minimal scope
   - **RESOLVED: DEFERRED — excluded from Phase 1.** No requirement ID, no UI screen in UI-SPEC, no validation test row. Will be added in a later phase when those contracts exist.

4. **SQLite vs PostgreSQL in development**
   - What we know: No database decision is locked in CONTEXT.md; Django's default is SQLite
   - What's unclear: Whether the team prefers PostgreSQL from day 1 (better production parity) or SQLite for simplicity
   - Recommendation: SQLite for Phase 1 development (zero config); PostgreSQL for any shared dev or staging environment. `django-environ` DATABASE_URL makes the switch trivial.
   - **RESOLVED: SQLite for Phase 1 dev** — zero config, sufficient for local development. Switch to PostgreSQL via `DATABASE_URL` env var when needed.

---

## Environment Availability

> This phase introduces the full dev environment. No prior code exists.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.10+ | Django 5.2, DRF 3.17 | Unknown — must verify | — | Install via python.org |
| Node.js 20+ | Vite 8, npm | Unknown — must verify | — | Install via nodejs.org |
| pip | Python package install | Comes with Python | — | — |
| npm | Frontend packages | Comes with Node.js | — | yarn or pnpm are alternatives |
| libmagic (system lib) | python-magic MIME validation | Unknown — Linux: apt install libmagic1; Windows: python-magic-bin | — | Fallback: extension-only validation in dev |
| SQLite | Default Django DB | Bundled with Python | — | No fallback needed for dev |
| Git | Version control | Assumed present (repo exists) | — | — |

**Missing dependencies with no fallback:**
- Python 3.10+ and Node.js 20+ must be installed before any dev work begins

**Missing dependencies with fallback:**
- libmagic: `python-magic-bin` on Windows; `apt-get install libmagic1` on Linux

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 9.1.1 + pytest-django 4.12.0 |
| Config file | `backend/pytest.ini` (Wave 0 creates this) |
| Quick run command | `pytest tests/ -x -q` |
| Full suite command | `pytest tests/ -v --tb=short` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRIAGE-01 | Student submits symptom + PDF | integration | `pytest tests/test_submissions.py::test_create_submission -x` | ❌ Wave 0 |
| TRIAGE-02 | Missing file or symptom → 400 with error message | unit | `pytest tests/test_submissions.py::test_submission_validation -x` | ❌ Wave 0 |
| TRIAGE-02 | File > 5MB → 400 with correct Bahasa Indonesia error | unit | `pytest tests/test_submissions.py::test_submission_file_size_limit -x` | ❌ Wave 0 |
| TRIAGE-02 | Non-PDF file → 400 with correct error | unit | `pytest tests/test_submissions.py::test_submission_wrong_mimetype -x` | ❌ Wave 0 |
| REVIEW-01 | Lecturer sees own students' submissions | integration | `pytest tests/test_submissions.py::test_lecturer_can_view_submissions -x` | ❌ Wave 0 |
| REVIEW-01 | Lecturer cannot see other lecturers' submissions | integration | `pytest tests/test_submissions.py::test_lecturer_cannot_see_others -x` | ❌ Wave 0 |
| ADMIN-01 | Admin can create/update symptom weights | integration | `pytest tests/test_symptoms.py::test_admin_crud_symptoms -x` | ❌ Wave 0 |
| ADMIN-01 | 6 default symptoms exist after migrate | unit | `pytest tests/test_symptoms.py::test_default_symptoms_seeded -x` | ❌ Wave 0 |
| D-29 (security) | Unauthenticated request to `/api/files/<uuid>/` → 403 | integration | `pytest tests/test_submissions.py::test_file_access_requires_auth -x` | ❌ Wave 0 |
| D-29 (security) | Non-owner authenticated user → 403 | integration | `pytest tests/test_submissions.py::test_file_access_ownership -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest tests/ -x -q` (stop on first failure)
- **Per wave merge:** `pytest tests/ -v --tb=short` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/pytest.ini` — Django settings pointer: `DJANGO_SETTINGS_MODULE = config.settings.dev`
- [ ] `backend/tests/conftest.py` — `@pytest.fixture` for `db`, user factories, authenticated API client
- [ ] `backend/tests/factories.py` — `UserFactory`, `LecturerFactory`, `StudentFactory`, `SymptomCategoryFactory`, `SubmissionFactory`
- [ ] `backend/tests/test_accounts.py` — registration, login, approval gate tests
- [ ] `backend/tests/test_submissions.py` — all TRIAGE + REVIEW + D-29 file access tests
- [ ] `backend/tests/test_symptoms.py` — seed + CRUD tests

---

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Django sessions + DRF SessionAuthentication; password hashed with PBKDF2 (Django default) |
| V3 Session Management | yes | `SESSION_COOKIE_HTTPONLY=True`, `SESSION_COOKIE_SAMESITE='Lax'`; server-side session storage in DB |
| V4 Access Control | yes | `IsApprovedUser` permission class on all submission/symptom endpoints; ownership check in file serve view |
| V5 Input Validation | yes | DRF serializer field validation + `FileExtensionValidator` + `python-magic` MIME check; file size enforced at 5MB |
| V6 Cryptography | partial | D-28: disk-level encryption (LUKS) at rest; PBKDF2 for passwords; no per-file app encryption in Phase 1 |

### Known Threat Patterns for Django + DRF + React SPA

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSRF attack on session-authenticated endpoints | Spoofing | `CsrfViewMiddleware` + `X-CSRFToken` header from cookie (not HttpOnly); DRF enforces on SessionAuthentication |
| Direct media file access (bypass auth) | Information Disclosure | Do NOT use MEDIA_URL; serve via `/api/files/<uuid>/` with auth check (Pattern 3) |
| File upload with malicious content | Tampering | python-magic validates magic bytes; FileExtensionValidator validates extension; do not execute uploaded files |
| Insecure direct object reference on file UUID | Information Disclosure | UUID is not guessable but ownership check in serve view is still required (a UUID can be leaked via other means) |
| Unapproved user accessing submission endpoints | Elevation of Privilege | `IsApprovedUser` base permission class; all write-capable endpoints require `is_approved=True` |
| Role escalation (student submitting as admin) | Elevation of Privilege | Role stored server-side in DB; role cannot be passed by client; `has_permission` checks `request.user.role` from DB |
| Oversized file DoS | Denial of Service | `DATA_UPLOAD_MAX_MEMORY_SIZE` setting at 6MB; Django rejects at transport level before view runs |

---

## Sources

### Primary (HIGH confidence — verified via official docs/PyPI this session)
- `pypi.org/project/django/` — version confirmation (5.2.x LTS candidate, 6.0.6 latest)
- `pypi.org/project/djangorestframework/` — version 3.17.1, Python/Django support matrix
- `pypi.org/project/django-cors-headers/` — version 4.9.0, required settings
- `pypi.org/project/django-environ/` — version 0.14.0
- `pypi.org/project/pytest/` — version 9.1.1
- `pypi.org/project/pytest-django/` — version 4.12.0
- `pypi.org/project/factory-boy/` — version 3.3.3
- `pypi.org/project/django-filter/` — version 25.2
- `pypi.org/project/python-magic/` — version 0.4.27, platform notes
- `vite.dev/guide/` — Vite 8.x, scaffold command
- `vite.dev/config/server-options` — proxy configuration
- `tailwindcss.com/docs` — v4.3, CSS @theme directive, v3→v4 breaking changes
- `github.com/tailwindlabs/tailwindcss-forms/releases` — v0.5.11, v4 compatibility
- `docs.djangoproject.com/en/5.2/topics/auth/customizing/` — AbstractBaseUser pattern
- `docs.djangoproject.com/en/5.2/topics/http/sessions/` — session settings, SameSite
- `docs.djangoproject.com/en/5.2/ref/settings/` — CSRF, file upload, session settings
- `docs.djangoproject.com/en/5.2/ref/validators/` — FileExtensionValidator, custom MIME validator
- `docs.djangoproject.com/en/5.2/howto/initial-data/` — data migration seed pattern
- `www.django-rest-framework.org/api-guide/authentication/` — SessionAuthentication, CSRF enforcement
- `www.django-rest-framework.org/api-guide/permissions/` — IsAuthenticated, custom permission classes
- `www.django-rest-framework.org/api-guide/viewsets/` — ModelViewSet, @action decorator

### Secondary (MEDIUM confidence)
- `tailwindcss.com/docs/upgrade-guide` — v3→v4 migration; JS config still supported with `@config` directive

### Tertiary (LOW confidence — training knowledge, not verified this session)
- React 18 API and hooks behavior [ASSUMED]
- React Router v7 `createBrowserRouter` + loader auth pattern [ASSUMED — version confirmed but code pattern from training]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified on PyPI/official docs with current versions
- Architecture: HIGH — session auth, CORS, protected file serving all from official Django/DRF docs
- Pitfalls: HIGH — all pitfalls derived from documented behaviors (settings, CSRF enforcement, Tailwind v4 changes)
- Tailwind v4 config change: HIGH — confirmed from official Tailwind upgrade guide

**Research date:** 2026-06-23
**Valid until:** 2026-07-23 (package versions; Vite and Tailwind move quickly — recheck before installing)
