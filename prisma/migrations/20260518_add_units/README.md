Migration: Add packaging fields and unit support

Overview

This migration adds support for box/strip packaging and records selling units on sales. It adds new columns to `Medicine` and `SaleItem` and treats `Batch.quantity` as the smallest-selling-unit (strips) for new data going forward.

Important: This migration does NOT automatically convert historical data because we cannot safely assume `stripsPerBox` for existing medicines. Follow the conversion steps below after you verify and set `stripsPerBox` on medicines where that applies.

Schema changes (applied via Prisma schema update)
- Add columns to `Medicine`: `stripsPerBox INTEGER DEFAULT 1`, `tabletsPerStrip INTEGER NULL`, `defaultSellingUnit TEXT DEFAULT 'BOX'`.
- Add column to `SaleItem`: `unit TEXT DEFAULT 'STRIP'`.

If you use Prisma Migrate, run:

  npx prisma migrate dev --name add_units

Manual SQL (SQLite)

To add columns manually (SQLite supports ALTER TABLE ADD COLUMN):

ALTER TABLE Medicine ADD COLUMN stripsPerBox INTEGER DEFAULT 1;
ALTER TABLE Medicine ADD COLUMN tabletsPerStrip INTEGER;
ALTER TABLE Medicine ADD COLUMN defaultSellingUnit TEXT DEFAULT 'BOX';
ALTER TABLE SaleItem ADD COLUMN unit TEXT DEFAULT 'STRIP';

Data conversion (optional, manual)

If your existing `Batch.quantity` values currently represent BOXES and you want to convert them to STRIPS (smallest units), do the following AFTER you set the correct `stripsPerBox` value for each affected `Medicine`.

-- Example conversion SQL (run only after verifying `stripsPerBox` values):

-- 1) Convert quantities from boxes -> strips
UPDATE Batch
SET quantity = quantity * (
  SELECT COALESCE(stripsPerBox, 1) FROM Medicine WHERE Medicine.id = Batch.medicineId
)
WHERE EXISTS (SELECT 1 FROM Medicine WHERE Medicine.id = Batch.medicineId AND COALESCE(Medicine.stripsPerBox, 1) > 1);

-- 2) Convert batch prices from per-box -> per-strip (divide by stripsPerBox)
UPDATE Batch
SET purchasePrice = purchasePrice / (
  SELECT COALESCE(stripsPerBox, 1) FROM Medicine WHERE Medicine.id = Batch.medicineId
)
WHERE EXISTS (SELECT 1 FROM Medicine WHERE Medicine.id = Batch.medicineId AND COALESCE(Medicine.stripsPerBox, 1) > 1);

UPDATE Batch
SET retailPrice = retailPrice / (
  SELECT COALESCE(stripsPerBox, 1) FROM Medicine WHERE Medicine.id = Batch.medicineId
)
WHERE EXISTS (SELECT 1 FROM Medicine WHERE Medicine.id = Batch.medicineId AND COALESCE(Medicine.stripsPerBox, 1) > 1);

Notes
- Backup your database before running any conversion SQL.
- If you prefer, set `stripsPerBox` to the correct value for each medicine and then run the conversion for only those medicines.
- After conversion, test POS checkout flows in a staging environment.

Post-migration
- Run `npx prisma generate` to regenerate the client after schema changes.
- Update any external integrations that assumed `Batch.quantity` = boxes.

Contact
If you want, I can prepare an automated conversion script that:
- Prompts you to set a default `stripsPerBox` for all medicines lacking it, or
- Produces a per-medicine SQL conversion summary to review before applying.
