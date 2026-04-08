-- AlterTable
ALTER TABLE "tarefas" ADD COLUMN     "observacaoConclusao" TEXT;

-- CreateIndex
CREATE INDEX "etiquetas_agenda_usuarioId_idx" ON "etiquetas_agenda"("usuarioId");

-- CreateIndex
CREATE INDEX "eventos_agenda_usuarioId_idx" ON "eventos_agenda"("usuarioId");

-- CreateIndex
CREATE INDEX "eventos_agenda_data_idx" ON "eventos_agenda"("data");
