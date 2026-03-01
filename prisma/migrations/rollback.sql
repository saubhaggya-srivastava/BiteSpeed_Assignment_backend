-- Rollback script for testing migration rollback functionality
-- This drops the contact table and all associated indexes and constraints

-- Drop foreign key constraint
ALTER TABLE "contact" DROP CONSTRAINT IF EXISTS "contact_linked_id_fkey";

-- Drop indexes
DROP INDEX IF EXISTS "contact_email_idx";
DROP INDEX IF EXISTS "contact_phone_number_idx";
DROP INDEX IF EXISTS "contact_linked_id_idx";
DROP INDEX IF EXISTS "contact_deleted_at_idx";

-- Drop table
DROP TABLE IF EXISTS "contact";
