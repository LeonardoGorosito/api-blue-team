-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentMethod" ADD VALUE 'SKRILL';
ALTER TYPE "PaymentMethod" ADD VALUE 'AIRTM';
ALTER TYPE "PaymentMethod" ADD VALUE 'PREX';
ALTER TYPE "PaymentMethod" ADD VALUE 'TIPFUNDER';

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "learningPoints" TEXT[],
ADD COLUMN     "longDescription" TEXT;
