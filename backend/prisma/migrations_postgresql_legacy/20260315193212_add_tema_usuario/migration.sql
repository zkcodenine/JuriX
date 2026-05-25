-- CreateEnum
CREATE TYPE "Tema" AS ENUM ('ESCURO', 'CLARO');

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "tema" "Tema" NOT NULL DEFAULT 'ESCURO';
