-- Dedupe existing treatments, then enforce one name per doctor (case-insensitive).
-- Applied statement-by-statement by scripts/applyMigrations.js — keep each as
-- plain DDL/DML ending in a newline (no DO $$ / function blocks).

-- 1) Remove duplicate treatments sharing (doctorId, lower(name)). Keep the
--    earliest-created row of each group ("ctid" is the physical-row tiebreak
--    when createdAt ties). Bills/appointments reference treatmentName (a string),
--    not the treatment id, so deleting duplicate rows is safe.
DELETE FROM "Treatment" a
USING "Treatment" b
WHERE a."doctorId" = b."doctorId"
  AND lower(a."name") = lower(b."name")
  AND (a."createdAt" > b."createdAt"
       OR (a."createdAt" = b."createdAt" AND a.ctid > b.ctid));

-- 2) Enforce uniqueness so future double-submits / races cannot recreate dupes.
CREATE UNIQUE INDEX "Treatment_doctorId_name_lower_key"
  ON "Treatment" ("doctorId", lower("name"));
