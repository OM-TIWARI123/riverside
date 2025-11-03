/*
  Warnings:

  - Added the required column `updatedAt` to the `Recording` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Recording" DROP CONSTRAINT "Recording_userId_fkey";

-- AlterTable
ALTER TABLE "Recording" ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'processing',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Recording_userId_idx" ON "Recording"("userId");

-- CreateIndex
CREATE INDEX "Recording_roomId_idx" ON "Recording"("roomId");

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
