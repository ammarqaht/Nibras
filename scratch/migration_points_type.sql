-- ============================================================
-- مايغريشن: إضافة عمود pointType لجدول النقاط
-- شغّل هذا في Neon Console → SQL Editor
-- ============================================================

-- 1. أضف العمود (إذا لم يكن موجوداً)
ALTER TABLE "Point"
  ADD COLUMN IF NOT EXISTS "pointType" TEXT NOT NULL DEFAULT 'individual';

-- 2. صنّف السجلات الجماعية الموجودة
UPDATE "Point"
  SET "pointType" = 'collective'
  WHERE reason LIKE '%(رصد جماعي للأسرة)';

-- 3. صنّف سجلات الخصم (delta سالب وليست جماعية)
UPDATE "Point"
  SET "pointType" = 'deduction'
  WHERE delta < 0 AND "pointType" = 'individual';

-- ✅ انتهى — يمكنك تشغيل الموقع الآن
