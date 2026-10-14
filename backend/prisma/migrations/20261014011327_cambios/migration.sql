-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "due_date" TIMESTAMP(3),
ADD COLUMN     "void_reason" VARCHAR(500),
ADD COLUMN     "voided_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "document_sequences" (
    "key" VARCHAR(40) NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("key")
);
