# Panduan Tim TemuDosen — Sprint Juli 2026

**Deadline: 15 Juli 2026**
**Target: Phase 1 ✅ → Phase 2 → Phase 3**
**Tim: 4 orang, semua kerja setiap hari**

---

## Daftar Isi

1. [Setup Awal](#1-setup-awal)
2. [Struktur Proyek](#2-struktur-proyek)
3. [Yang Sudah Jadi (Phase 1)](#3-yang-sudah-jadi-phase-1)
4. [Pembagian Tugas](#4-pembagian-tugas)
5. [Person A — Auth & User Management](#5-person-a--auth--user-management)
6. [Person B — Submission & Gejala](#6-person-b--submission--gejala)
7. [Person C — Persetujuan & Triage](#7-person-c--persetujuan--triage)
8. [Person D — Antrian (Queue)](#8-person-d--antrian-queue)
9. [Aturan Koordinasi Tim](#9-aturan-koordinasi-tim)
10. [Cara Menjalankan Server](#10-cara-menjalankan-server)

---

## 1. Setup Awal

Lakukan ini sekali di komputer masing-masing sebelum mulai kerja.

```bash
# Masuk ke folder backend
cd TemuDosen/backend

# Aktifkan virtual environment
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # Mac/Linux

# Install dependensi
pip install -r requirements.txt

# Salin file .env
copy .env.example .env          # Windows
cp .env.example .env            # Mac/Linux

# Jalankan migrasi
python manage.py migrate

# Buat admin
python manage.py seed_admin

# Jalankan server
python manage.py runserver
```

Server berjalan di: `http://127.0.0.1:8000`

---

## 2. Struktur Proyek

```
TemuDosen/
├── backend/
│   ├── apps/
│   │   ├── accounts/       ← User, login, register, approval (Person A)
│   │   ├── submissions/    ← Form pengajuan, file upload (Person B & C)
│   │   ├── symptoms/       ← Kategori gejala & bobot (Person B)
│   │   └── queue/          ← Antrian, kuota, status (Person C & D) ← BUAT BARU
│   ├── config/
│   │   ├── settings/
│   │   └── urls.py         ← URL utama
│   └── manage.py
└── INTERFACES.md           ← Kontrak antar anggota tim — WAJIB DIBACA
```

---

## 3. Yang Sudah Jadi (Phase 1)

Jangan ubah file-file ini kecuali ada kebutuhan mendesak dan sudah diskusi tim:

| File | Isi |
|------|-----|
| `apps/accounts/models.py` | Model `CustomUser` dengan role, NIM, NIDN, adviser |
| `apps/accounts/views.py` | Login, logout, register, approval admin |
| `apps/accounts/permissions.py` | `IsStudent`, `IsLecturer`, `IsAdmin`, `IsApprovedUser` |
| `apps/submissions/models.py` | Model `Submission` dan `SubmissionFile` |
| `apps/submissions/views.py` | Submit pengajuan, list mahasiswa, list dosen, serve PDF |
| `apps/symptoms/models.py` | Model `SymptomCategory` dengan `duration_minutes` |

**API yang sudah aktif:**

| Method | URL | Siapa |
|--------|-----|-------|
| POST | `/api/auth/login/` | Semua |
| POST | `/api/auth/logout/` | Semua |
| GET | `/api/auth/me/` | Semua |
| POST | `/api/auth/register/` | Publik |
| GET | `/api/users/lecturers/` | Publik (untuk dropdown register) |
| GET | `/api/users/pending/` | Admin |
| POST | `/api/users/<id>/approve/` | Admin |
| POST | `/api/users/<id>/reject/` | Admin |
| POST | `/api/submissions/` | Mahasiswa |
| GET | `/api/submissions/` | Mahasiswa (list milik sendiri) |
| GET | `/api/submissions/lecturer/` | Dosen (list advisee) |
| GET | `/api/files/<uuid>/` | Owner / adviser / admin |

---

## 4. Pembagian Tugas

| Person | Area | Hari Mulai |
|--------|------|-----------|
| **A** | Auth & User — registrasi, approval, redirect per role | Hari 1 |
| **B** | Submission & Gejala — form pengajuan, upload PDF, My Submissions | Hari 1 |
| **C** | Persetujuan & Triage — approve/reject, hitung durasi, buat QueueSlot | Hari 3 |
| **D** | Antrian — status antrian, self-cancel, kuota harian | Hari 1 (desain model dulu) |

**Urutan ketergantungan:**
```
A selesai login → B bisa test submission
B selesai submission → C bisa test approve
C selesai QueueSlot → D bisa build antrian
```

A dan B kerja **paralel** dari hari pertama.

---

## 5. Person A — Auth & User Management

> **Tugas:** Pastikan alur registrasi dan login berjalan sempurna dengan redirect yang benar per role.

Phase 1 sudah membangun fondasi auth. Tugasmu adalah **memastikan semua flow berjalan end-to-end** dan menambah satu fitur yang belum ada.

### 5.1 Yang Perlu Dicek & Diperbaiki

#### Cek: Registrasi mahasiswa memilih dosen pembimbing

Endpoint `GET /api/users/lecturers/` sudah ada. Pastikan response-nya benar:

```bash
curl http://127.0.0.1:8000/api/users/lecturers/
# Harus return list dosen yang is_approved=True
# Kalau kosong, approve dosen dulu lewat admin
```

#### Cek: Login blokir user yang belum diapprove

Di `accounts/views.py`, `LoginView` memanggil `authenticate()` lalu `login()`.
Masalah: user yang `is_approved=False` bisa login karena Django tidak cek itu.

**Tambahkan pengecekan ini di `LoginView.post()`:**

```python
# Setelah user = authenticate(...)
if user is None:
    return Response({'detail': 'Email atau password salah.'}, status=401)

# TAMBAHKAN INI:
if not user.is_approved:
    return Response(
        {'detail': 'Akun kamu sedang menunggu persetujuan admin.'},
        status=403
    )

login(request, user)
```

File: `backend/apps/accounts/views.py` baris ~51

#### Tambah: Endpoint redirect info per role

Buat endpoint baru yang frontend bisa panggil setelah login untuk tahu harus ke halaman mana:

File baru: tidak perlu. Cukup pastikan `GET /api/auth/me/` mengembalikan field `role`.
Cek di `accounts/serializers.py` — pastikan `role` ada di fields `UserSerializer`.

### 5.2 Tugas Baru: Halaman "Menunggu Persetujuan"

Karena project ini pakai Django REST Framework (API-based), frontend perlu tahu status approval.
Pastikan response dari `POST /api/auth/register/` mengembalikan:

```json
{
  "id": 5,
  "email": "mahasiswa@example.com",
  "full_name": "Nama Lengkap",
  "role": "student",
  "is_approved": false
}
```

Frontend akan baca `is_approved: false` dan tampilkan pesan "Akun menunggu persetujuan admin".

### 5.3 Cara Test Manual

```bash
# 1. Register sebagai mahasiswa
curl -X POST http://127.0.0.1:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{"email":"mhs@test.com","password":"Test1234!","full_name":"Budi","role":"student","nim":"12345","adviser":1}'

# 2. Coba login (harus gagal dengan 403 karena belum diapprove)
curl -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"mhs@test.com","password":"Test1234!"}'

# 3. Approve lewat admin
curl -X POST http://127.0.0.1:8000/api/users/1/approve/ \
  -H "Cookie: sessionid=..." 

# 4. Coba login lagi (harus berhasil)
```

### 5.4 File yang Boleh Diubah Person A

- `apps/accounts/views.py` ← tambah cek `is_approved` di LoginView
- `apps/accounts/serializers.py` ← pastikan field `role` dan `is_approved` ada
- `apps/accounts/tests/test_auth.py` ← tambah test kasus login belum diapprove

### 5.5 File yang TIDAK BOLEH Diubah Person A

- `apps/accounts/models.py` — sudah final
- `apps/accounts/permissions.py` — sudah final
- File milik B, C, D

---

## 6. Person B — Submission & Gejala

> **Tugas:** Pastikan submission mahasiswa berjalan sempurna dan tambahkan field `rejection_notes` untuk Phase 2.

### 6.1 Yang Perlu Dicek

#### Cek: Upload PDF berjalan

```bash
# Test upload PDF
curl -X POST http://127.0.0.1:8000/api/submissions/ \
  -b "sessionid=..." \
  -F "symptom_ids=1" \
  -F "description=Saya butuh bimbingan bab 3" \
  -F "draft_file=@/path/to/file.pdf"
```

Harus return `201 Created` dengan `file_uuid`.

#### Cek: Validasi file

Cek di `apps/submissions/serializers.py` — pastikan ada validasi:
- File wajib ada
- Ukuran maks 5MB
- Tipe file harus PDF

### 6.2 Tugas Baru: Tambah Field `rejection_notes`

**Ini penting untuk Person C!** Person C butuh field ini untuk simpan catatan penolakan.

**Langkah 1:** Edit `apps/submissions/models.py`

```python
class Submission(models.Model):
    # ... field yang sudah ada ...
    
    # TAMBAHKAN INI:
    rejection_notes = models.TextField(
        blank=True,
        default='',
        help_text='Catatan penolakan dari dosen (diisi saat status rejected/revision)'
    )
```

**Langkah 2:** Buat migrasi

```bash
python manage.py makemigrations submissions
python manage.py migrate
```

**Langkah 3:** Expose di serializer

Di `apps/submissions/serializers.py`, tambahkan `rejection_notes` ke `SubmissionListSerializer` agar mahasiswa bisa lihat alasan penolakan:

```python
class SubmissionListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Submission
        fields = [
            'id', 'symptoms', 'description', 'status',
            'rejection_notes',  # TAMBAHKAN INI
            'created_at', 'updated_at',
        ]
```

### 6.3 Tugas Baru: Pastikan "My Submissions" Tampilkan Status Lengkap

`GET /api/submissions/` sudah ada. Pastikan response-nya menyertakan:
- Nama gejala (bukan hanya ID)
- Status dalam Bahasa Indonesia
- `rejection_notes` (kalau ada)
- Link ke file: `file_uuid` untuk konstruksi URL `/api/files/<uuid>/`

### 6.4 File yang Boleh Diubah Person B

- `apps/submissions/models.py` ← tambah `rejection_notes`
- `apps/submissions/serializers.py` ← expose `rejection_notes`
- `apps/submissions/tests/` ← tambah test

### 6.5 File yang TIDAK BOLEH Diubah Person B

- `apps/accounts/` — milik A
- `apps/symptoms/models.py` — sudah final (jangan ubah struktur)

---

## 7. Person C — Persetujuan & Triage

> **Tugas:** Bangun fitur approve/reject oleh dosen dan buat model `QueueSlot`.

**Mulai kerja hari ke-3**, setelah Person A punya sistem login yang berfungsi.

### 7.1 Langkah 1: Buat App `queue`

```bash
cd backend
python manage.py startapp queue apps/queue
```

Tambahkan ke `config/settings/base.py`:

```python
INSTALLED_APPS = [
    # ... yang sudah ada ...
    'apps.queue',   # TAMBAHKAN INI
]
```

### 7.2 Langkah 2: Buat Model `QueueSlot`

File: `apps/queue/models.py`

```python
from django.db import models
from django.conf import settings


class QueueSlot(models.Model):

    class Status(models.TextChoices):
        QUEUED = 'queued', 'Menunggu'
        IN_PROGRESS = 'in_progress', 'Sedang Bimbingan'
        DONE = 'done', 'Selesai'
        CANCELLED = 'cancelled', 'Dibatalkan'

    submission = models.OneToOneField(
        'submissions.Submission',
        on_delete=models.CASCADE,
        related_name='queue_slot'
    )
    lecturer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='queue_slots',
        limit_choices_to={'role': 'lecturer'}
    )
    queue_number = models.PositiveIntegerField()
    estimated_duration = models.PositiveIntegerField(
        help_text='Total estimasi durasi bimbingan dalam menit'
    )
    estimated_start = models.DateTimeField(
        help_text='Estimasi waktu mulai bimbingan'
    )
    date = models.DateField(
        help_text='Tanggal bimbingan'
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.QUEUED
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date', 'queue_number']
        # Nomor antrian unik per dosen per tanggal
        unique_together = [['lecturer', 'date', 'queue_number']]

    def __str__(self):
        return f'Antrian #{self.queue_number} — {self.submission.student.full_name} ({self.date})'
```

Setelah itu:

```bash
python manage.py makemigrations queue
python manage.py migrate
```

### 7.3 Langkah 3: Buat View Approve & Reject

File baru: `apps/submissions/approval_views.py`

```python
"""
View untuk approve/reject submission oleh dosen.
Dipanggil dari URL: 
  POST /api/submissions/<id>/approve/
  POST /api/submissions/<id>/reject/
"""
import datetime
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsLecturer
from apps.queue.models import QueueSlot

from .models import Submission


class ApproveSubmissionView(APIView):
    """
    POST /api/submissions/<id>/approve/
    Hanya dosen pembimbing mahasiswa tersebut yang boleh approve.
    """
    permission_classes = [IsLecturer]

    def post(self, request, pk):
        submission = get_object_or_404(
            Submission,
            pk=pk,
            student__adviser=request.user,   # keamanan: hanya advisee sendiri
            status=Submission.Status.PENDING  # hanya yang masih pending
        )

        # Hitung total durasi dari semua gejala yang dipilih
        total_duration = sum(
            s.duration_minutes for s in submission.symptoms.all()
        )
        if total_duration == 0:
            total_duration = 30  # default 30 menit kalau gejala tidak punya bobot

        # Tentukan tanggal bimbingan = hari ini
        today = timezone.localdate()

        # Ambil nomor antrian berikutnya (import dari queue/quota.py milik Person D)
        from apps.queue.quota import assign_queue_number, get_remaining_quota

        # Cek kuota sisa
        remaining = get_remaining_quota(request.user, today)
        if remaining < total_duration:
            return Response(
                {
                    'detail': (
                        f'Kuota harian dosen tidak mencukupi. '
                        f'Sisa kuota: {remaining} menit, '
                        f'dibutuhkan: {total_duration} menit.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        queue_number = assign_queue_number(request.user, today)

        # Estimasi waktu mulai = sekarang + total durasi antrian sebelumnya
        # (versi sederhana: pakai waktu kerja mulai jam 08:00)
        existing_slots = QueueSlot.objects.filter(
            lecturer=request.user,
            date=today,
            status=QueueSlot.Status.QUEUED
        ).order_by('queue_number')

        occupied_minutes = sum(s.estimated_duration for s in existing_slots)
        start_of_day = timezone.make_aware(
            datetime.datetime.combine(today, datetime.time(8, 0))
        )
        estimated_start = start_of_day + datetime.timedelta(minutes=occupied_minutes)

        # Buat slot antrian
        QueueSlot.objects.create(
            submission=submission,
            lecturer=request.user,
            queue_number=queue_number,
            estimated_duration=total_duration,
            estimated_start=estimated_start,
            date=today,
        )

        # Update status submission
        submission.status = Submission.Status.APPROVED
        submission.save(update_fields=['status', 'updated_at'])

        return Response({
            'detail': 'Pengajuan disetujui.',
            'queue_number': queue_number,
            'estimated_duration': total_duration,
            'estimated_start': estimated_start.isoformat(),
        }, status=status.HTTP_200_OK)


class RejectSubmissionView(APIView):
    """
    POST /api/submissions/<id>/reject/
    Body: {"action": "rejected" | "revision", "rejection_notes": "..."}
    Hanya dosen pembimbing mahasiswa tersebut yang boleh reject.
    """
    permission_classes = [IsLecturer]

    def post(self, request, pk):
        submission = get_object_or_404(
            Submission,
            pk=pk,
            student__adviser=request.user,
            status=Submission.Status.PENDING
        )

        action = request.data.get('action', '')
        if action not in ('rejected', 'revision'):
            return Response(
                {'detail': 'action harus "rejected" atau "revision".'},
                status=status.HTTP_400_BAD_REQUEST
            )

        notes = request.data.get('rejection_notes', '').strip()
        if not notes:
            return Response(
                {'detail': 'rejection_notes wajib diisi saat menolak atau meminta revisi.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        submission.status = action
        submission.rejection_notes = notes
        submission.save(update_fields=['status', 'rejection_notes', 'updated_at'])

        return Response({
            'detail': 'Status pengajuan diperbarui.',
            'status': submission.status,
            'rejection_notes': submission.rejection_notes,
        }, status=status.HTTP_200_OK)
```

### 7.4 Langkah 4: Daftarkan URL Baru

Edit `apps/submissions/urls.py`, tambahkan:

```python
from .approval_views import ApproveSubmissionView, RejectSubmissionView

urlpatterns = [
    path('', SubmissionListCreateView.as_view(), name='submission-list-create'),
    path('lecturer/', LecturerSubmissionListView.as_view(), name='submission-lecturer-list'),
    # TAMBAHKAN INI:
    path('<int:pk>/approve/', ApproveSubmissionView.as_view(), name='submission-approve'),
    path('<int:pk>/reject/', RejectSubmissionView.as_view(), name='submission-reject'),
]
```

### 7.5 Cara Test Manual

```bash
# Login sebagai dosen dulu
curl -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"dosen@test.com","password":"Test1234!"}'

# Ambil CSRF token
CSRF=$(grep csrftoken cookies.txt | awk '{print $7}')

# Approve submission ID 1
curl -X POST http://127.0.0.1:8000/api/submissions/1/approve/ \
  -H "X-CSRFToken: $CSRF" \
  -b cookies.txt

# Reject submission ID 2
curl -X POST http://127.0.0.1:8000/api/submissions/2/reject/ \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: $CSRF" \
  -b cookies.txt \
  -d '{"action":"revision","rejection_notes":"Bab 2 perlu diperkuat dengan referensi lebih banyak."}'
```

### 7.6 File yang Boleh Diubah Person C

- `apps/queue/models.py` ← buat model QueueSlot
- `apps/queue/migrations/` ← hasil makemigrations
- `apps/submissions/approval_views.py` ← buat baru
- `apps/submissions/urls.py` ← tambah route approve/reject
- `apps/submissions/models.py` ← HANYA tambah `rejection_notes` (koordinasi dengan B)

### 7.7 File yang TIDAK BOLEH Diubah Person C

- `apps/submissions/views.py` — milik B, jangan disentuh
- `apps/accounts/` — milik A

---

## 8. Person D — Antrian (Queue)

> **Tugas:** Bangun logika kuota harian, nomor antrian, dan halaman status antrian mahasiswa.

**Mulai desain model dari hari 1**, tapi mulai coding besar setelah C commit `QueueSlot`.

### 8.1 Langkah 1: Buat File `quota.py`

File: `apps/queue/quota.py`

```python
"""
Fungsi helper untuk manajemen kuota dan nomor antrian dosen.
Dipakai oleh Person C di approval_views.py.
"""
import datetime
from django.conf import settings

from .models import QueueSlot

# Kuota harian default: 8 jam = 480 menit
DEFAULT_DAILY_QUOTA_MINUTES = getattr(settings, 'DAILY_QUOTA_MINUTES', 480)


def get_remaining_quota(lecturer, date: datetime.date) -> int:
    """
    Kembalikan sisa kuota (dalam menit) untuk dosen pada tanggal tertentu.
    
    Kuota sisa = kuota harian - total durasi slot yang sudah ada (status QUEUED atau IN_PROGRESS).
    """
    used_minutes = QueueSlot.objects.filter(
        lecturer=lecturer,
        date=date,
        status__in=[QueueSlot.Status.QUEUED, QueueSlot.Status.IN_PROGRESS]
    ).aggregate(
        total=models.Sum('estimated_duration')
    )['total'] or 0

    return DEFAULT_DAILY_QUOTA_MINUTES - used_minutes


def assign_queue_number(lecturer, date: datetime.date) -> int:
    """
    Kembalikan nomor antrian berikutnya untuk dosen pada tanggal tertentu.
    
    Ambil nomor terbesar yang ada hari ini, tambah 1.
    Kalau belum ada antrian hari ini, mulai dari 1.
    """
    from django.db.models import Max

    last_number = QueueSlot.objects.filter(
        lecturer=lecturer,
        date=date,
    ).aggregate(max_num=Max('queue_number'))['max_num']

    return (last_number or 0) + 1
```

**Catatan penting:** Tambahkan import `models` di atas file:

```python
from django.db import models
```

### 8.2 Langkah 2: View Status Antrian untuk Mahasiswa

File: `apps/queue/views.py`

```python
"""
Views antrian untuk mahasiswa.
  GET /api/queue/my/       — mahasiswa lihat status antrian mereka sendiri
  POST /api/queue/<id>/cancel/ — mahasiswa batalkan slot antrian
"""
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsStudent
from .models import QueueSlot
from .serializers import QueueSlotSerializer


class MyQueueView(APIView):
    """
    GET /api/queue/my/
    Mahasiswa lihat slot antrian aktif mereka (status=queued atau in_progress).
    """
    permission_classes = [IsStudent]

    def get(self, request):
        slots = QueueSlot.objects.filter(
            submission__student=request.user,
            status__in=[QueueSlot.Status.QUEUED, QueueSlot.Status.IN_PROGRESS]
        ).select_related('submission', 'lecturer').order_by('date', 'queue_number')

        if not slots.exists():
            return Response({'detail': 'Tidak ada antrian aktif.'}, status=200)

        serializer = QueueSlotSerializer(slots, many=True)
        return Response(serializer.data)


class CancelQueueView(APIView):
    """
    POST /api/queue/<id>/cancel/
    Mahasiswa batalkan slot antrian mereka sendiri.
    Hanya bisa dibatalkan kalau status masih 'queued'.
    """
    permission_classes = [IsStudent]

    def post(self, request, pk):
        slot = get_object_or_404(
            QueueSlot,
            pk=pk,
            submission__student=request.user  # keamanan: hanya milik sendiri
        )

        if slot.status != QueueSlot.Status.QUEUED:
            return Response(
                {'detail': 'Antrian tidak bisa dibatalkan. Status sudah berubah.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        slot.status = QueueSlot.Status.CANCELLED
        slot.save(update_fields=['status'])

        return Response({'detail': 'Antrian berhasil dibatalkan.'}, status=200)
```

### 8.3 Langkah 3: Serializer Antrian

File: `apps/queue/serializers.py`

```python
from rest_framework import serializers
from .models import QueueSlot


class QueueSlotSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='submission.student.full_name', read_only=True)
    lecturer_name = serializers.CharField(source='lecturer.full_name', read_only=True)
    symptom_names = serializers.SerializerMethodField()

    def get_symptom_names(self, obj):
        return [s.name for s in obj.submission.symptoms.all()]

    class Meta:
        model = QueueSlot
        fields = [
            'id',
            'queue_number',
            'estimated_duration',
            'estimated_start',
            'date',
            'status',
            'student_name',
            'lecturer_name',
            'symptom_names',
        ]
```

### 8.4 Langkah 4: URL Antrian

File: `apps/queue/urls.py`

```python
from django.urls import path
from .views import MyQueueView, CancelQueueView

urlpatterns = [
    path('my/', MyQueueView.as_view(), name='queue-my'),
    path('<int:pk>/cancel/', CancelQueueView.as_view(), name='queue-cancel'),
]
```

### 8.5 Langkah 5: Daftarkan ke URL Utama

Edit `config/urls.py`, tambahkan:

```python
path('api/queue/', include('apps.queue.urls')),
```

### 8.6 Langkah 6: Tambahkan `apps/queue/apps.py`

```python
from django.apps import AppConfig

class QueueConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.queue'
    label = 'queue'
```

### 8.7 Cara Test Manual

```bash
# Login sebagai mahasiswa
curl -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"mhs@test.com","password":"Test1234!"}'

# Lihat antrian aktif
curl http://127.0.0.1:8000/api/queue/my/ -b cookies.txt

# Batalkan antrian ID 1
curl -X POST http://127.0.0.1:8000/api/queue/1/cancel/ \
  -H "X-CSRFToken: $CSRF" \
  -b cookies.txt
```

### 8.8 Bonus: View Antrian per Dosen (untuk Phase 3)

Ini untuk dosen lihat semua antrian harinya:

```python
class LecturerQueueView(APIView):
    """
    GET /api/queue/lecturer/
    Dosen lihat semua slot antrian aktif hari ini milik mereka.
    """
    permission_classes = [IsLecturer]

    def get(self, request):
        from django.utils import timezone
        today = timezone.localdate()

        slots = QueueSlot.objects.filter(
            lecturer=request.user,
            date=today,
            status__in=[QueueSlot.Status.QUEUED, QueueSlot.Status.IN_PROGRESS]
        ).select_related('submission__student').prefetch_related('submission__symptoms')

        serializer = QueueSlotSerializer(slots, many=True)
        return Response(serializer.data)
```

Tambahkan URL-nya:

```python
path('lecturer/', LecturerQueueView.as_view(), name='queue-lecturer'),
```

### 8.9 File yang Boleh Diubah Person D

- `apps/queue/quota.py` ← buat baru
- `apps/queue/views.py` ← buat baru
- `apps/queue/serializers.py` ← buat baru
- `apps/queue/urls.py` ← buat baru
- `apps/queue/apps.py` ← buat baru
- `config/urls.py` ← tambah route `/api/queue/`
- `config/settings/base.py` ← tambah `apps.queue` ke INSTALLED_APPS

### 8.10 File yang TIDAK BOLEH Diubah Person D

- `apps/queue/models.py` — milik C, jangan diubah tanpa diskusi
- `apps/submissions/` — milik B/C
- `apps/accounts/` — milik A

---

## 9. Aturan Koordinasi Tim

### 9.1 Wajib Baca INTERFACES.md

Setiap mau pakai model atau fungsi orang lain, baca dulu `INTERFACES.md` di root folder.
Kalau kamu sudah finalisasi sesuatu (field baru, fungsi baru), update file itu.

### 9.2 Jangan Ubah File Orang Lain

Kalau butuh perubahan di file orang lain (misalnya butuh field baru di model orang lain), **diskusi dulu**, jangan langsung edit.

### 9.3 Commit Kecil & Sering

```bash
# Contoh commit yang baik
git add apps/queue/quota.py
git commit -m "feat(queue): add get_remaining_quota and assign_queue_number"

# Jangan commit semua sekaligus
# git add .   ← hindari ini
```

### 9.4 Nama Branch per Person

```
git checkout -b feature/person-a-auth
git checkout -b feature/person-b-submission
git checkout -b feature/person-c-approval
git checkout -b feature/person-d-queue
```

### 9.5 Kalau Ada Error Import

Kalau kamu import dari app orang lain dan dapat error, kemungkinan:
1. Orang itu belum commit perubahan mereka
2. Kamu belum jalankan `python manage.py migrate`
3. App belum terdaftar di `INSTALLED_APPS`

---

## 10. Cara Menjalankan Server

```bash
# Aktifkan venv dulu
cd TemuDosen/backend
.venv\Scripts\activate

# Setiap pull dari git, selalu jalankan ini:
python manage.py migrate

# Jalankan server
python manage.py runserver

# Jalankan test
python manage.py test apps.accounts apps.submissions apps.symptoms apps.queue
```

### Endpoint Lengkap Setelah Phase 2 & 3 Selesai

| Method | URL | Siapa | Phase |
|--------|-----|-------|-------|
| POST | `/api/auth/login/` | Semua | 1 ✅ |
| POST | `/api/auth/logout/` | Semua | 1 ✅ |
| GET | `/api/auth/me/` | Semua | 1 ✅ |
| POST | `/api/auth/register/` | Publik | 1 ✅ |
| GET | `/api/users/lecturers/` | Publik | 1 ✅ |
| GET | `/api/users/pending/` | Admin | 1 ✅ |
| POST | `/api/users/<id>/approve/` | Admin | 1 ✅ |
| POST | `/api/users/<id>/reject/` | Admin | 1 ✅ |
| POST | `/api/submissions/` | Mahasiswa | 1 ✅ |
| GET | `/api/submissions/` | Mahasiswa | 1 ✅ |
| GET | `/api/submissions/lecturer/` | Dosen | 1 ✅ |
| GET | `/api/files/<uuid>/` | Owner/Adviser/Admin | 1 ✅ |
| POST | `/api/submissions/<id>/approve/` | Dosen | **2** |
| POST | `/api/submissions/<id>/reject/` | Dosen | **2** |
| GET | `/api/queue/my/` | Mahasiswa | **3** |
| POST | `/api/queue/<id>/cancel/` | Mahasiswa | **3** |
| GET | `/api/queue/lecturer/` | Dosen | **3** |

---

*Dokumen ini dibuat 25 Juni 2026. Update kalau ada perubahan struktur atau keputusan baru.*
