-- AddTable: etiquetas_agenda
CREATE TABLE "etiquetas_agenda" (
  "id"        TEXT         NOT NULL,
  "usuarioId" TEXT         NOT NULL,
  "nome"      TEXT         NOT NULL,
  "cor"       TEXT         NOT NULL DEFAULT '#C9A84C',
  "criadoEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "etiquetas_agenda_pkey" PRIMARY KEY ("id")
);

-- AddTable: eventos_agenda
CREATE TABLE "eventos_agenda" (
  "id"           TEXT         NOT NULL,
  "usuarioId"    TEXT         NOT NULL,
  "etiquetaId"   TEXT,
  "titulo"       TEXT         NOT NULL,
  "data"         TIMESTAMP(3) NOT NULL,
  "horario"      TEXT,
  "descricao"    TEXT,
  "criadoEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "eventos_agenda_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "etiquetas_agenda"
  ADD CONSTRAINT "etiquetas_agenda_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_agenda"
  ADD CONSTRAINT "eventos_agenda_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_agenda"
  ADD CONSTRAINT "eventos_agenda_etiquetaId_fkey"
  FOREIGN KEY ("etiquetaId") REFERENCES "etiquetas_agenda"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
