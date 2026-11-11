# Növbəti addımlar (2026-11-05 sonu)

## Push vəziyyəti

- Branch: `main`, remote: `origin` → `https://github.com/vugarbabirov01-tech/NovaHR.git`
- Yerli `main` origin/main-dən **1 commit öndədir**: `7c7ba3d feat(auth): implement RBAC service layer and security tests`
- Bu commit artıq edilib, amma **push edilməyib** — təsdiq gözləyir.
- Working tree təmizdir, commit ediləcək yeni dəyişiklik yoxdur.

## Authentication Phase A — hazır olan

- Sxem (8 cədvəl + `UserRoleAssignment.activeKey`) real `dev.db`-yə tətbiq edilib (backup `backups/dev.db.pre-activekey-migration.20261105-112003.bak`), sıfır data itkisi.
- Service Layer: Permission Registry (23 icazə), Role-Permission Matrix (7 rol), User/Role/Permission/UserRoleAssignment repository+service, Auth Audit Log, Approval Engine-də tapılmış `isActiveKeyConflict` bug-fix — hamısı committed (`7c7ba3d`).
- `prisma/seed-auth.ts` və `scripts/bootstrap-super-admin.ts` yazılıb, **icra edilməyib**.
- Son iş: real `dev.db` üçün tam read-only seed preview təqdim edildi (7 rol, 23 icazə, 73 rol-icazə əlaqəsi) — DB-də sıfır dəyişiklik, kod dəyişməyib.

## Açıq qərar (sizin cavabınız gözlənir)

- `prisma/seed-auth.ts`-ə əsl `--dry-run` rejimi əlavə edilsin, yoxsa mövcud `--confirm-widening` məntiqi kifayətdir? (Hazırkı skript bayraqsız belə Role/Permission kataloq sətirlərini yazır — yalnız RolePermission qrantları qoruma altındadır.)

## Təsdiqiniz olmadan edilməyəcək addımlar

1. `prisma/seed-auth.ts`-in icrası (bayraqlı və ya bayraqsız)
2. Bootstrap Super Admin yaradılması
3. Authentication Mərhələ B (login/session aktivləşdirmə)
4. Report Builder Mərhələ 3
5. `git push`

## Permission Matrix-də hələ açıq qalan maddələr

- `HR_SPECIALIST`: `EMPLOYEES_DELETE` / `REPORTS_DELETE` — mübahisəli, qərar gözləyir
- `COMPANY_MANAGER` / `BRANCH_MANAGER`: `LEAVE_CREATE` / `LEAVE_CANCEL` — mübahisəli, qərar gözləyir

## Qeyd

Bu gün heç bir yeni kod yazılmayıb, seed icra edilməyib, migration tətbiq edilməyib — yalnız mövcud `dev.db` üzərində read-only analiz aparılıb.
