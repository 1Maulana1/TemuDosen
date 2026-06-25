# Interface Contracts

Shared contracts between team members. Update this file when you finalize a model field or function signature. Others read this before calling your code.

---

## Models

### `CustomUser` (apps/accounts/models.py) — Owner: Person A

```python
email           # login identifier
full_name
role            # 'student' | 'lecturer' | 'admin' | 'kaprodi'
nim             # students only
nidn            # lecturers only
is_approved     # False until admin approves
adviser         # FK to self (lecturer), set by student at registration
```

**Status:** ✅ Done

---

### `SymptomCategory` (apps/symptoms/models.py) — Owner: Person B

```python
name
duration_minutes    # weight used to calculate triage duration
is_active
```

**Status:** ✅ Done

---

### `Submission` (apps/submissions/models.py) — Owner: Person B

```python
student         # FK to CustomUser (role=student)
symptoms        # M2M to SymptomCategory
description
status          # 'pending' | 'approved' | 'rejected' | 'revision'
rejection_notes # CharField, filled by lecturer on reject/revision — ADD THIS FIELD
created_at
updated_at
```

**Status:** 🔄 In progress — `rejection_notes` field needs to be added

---

### `QueueSlot` (apps/queue/models.py) — Owner: Person C

```python
submission          # OneToOne FK to Submission
lecturer            # FK to CustomUser (role=lecturer)
queue_number        # PositiveIntegerField, unique per lecturer per date
estimated_duration  # minutes (sum of symptom weights)
estimated_start     # DateTimeField
date                # DateField
status              # 'queued' | 'in_progress' | 'done' | 'cancelled'
created_at
```

**Status:** ⏳ To be created (Phase 2)

---

## Functions

### `get_remaining_quota(lecturer, date)` — Owner: Person D
Location: `apps/queue/quota.py`

```python
def get_remaining_quota(lecturer: CustomUser, date: date) -> int:
    """Returns remaining daily quota in minutes for lecturer on date."""
```

**Default daily quota:** 480 minutes (8 hours)
**Status:** ⏳ To be created (Phase 3)

---

### `assign_queue_number(lecturer, date)` — Owner: Person D
Location: `apps/queue/quota.py`

```python
def assign_queue_number(lecturer: CustomUser, date: date) -> int:
    """Returns next available queue number for lecturer on date."""
```

**Status:** ⏳ To be created (Phase 2, used by Person C's approve view)

---

## URL Namespaces

| App | Namespace | Owner |
|-----|-----------|-------|
| accounts | `accounts:` | A |
| submissions | `submissions:` | B |
| queue | `queue:` | C/D |

---

## Dependency Order

```
A (auth) → B (submission) → C (approval) → D (queue)
```

A and B work in parallel from day 1.
C starts after A has working login + role system.
D starts after C has QueueSlot model committed.
