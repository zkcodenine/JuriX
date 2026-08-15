-- ══════════════════════════════════════════════════════════════════
--  Migração ADITIVA — cria a tabela documentos_conteudo (bytes no banco).
--
--  SEGURANÇA: este script apenas CRIA uma tabela nova. NÃO há DROP, NÃO há
--  ALTER em tabela existente. As tabelas do app "Cards de Saúde"
--  (cards_projects, cards_municipios, cards_logos_modelo) NÃO são tocadas.
--
--  Aplicar SEM `prisma db push` (que geraria DROP nas cards_*). Rode:
--    npx prisma db execute --schema prisma/schema.prisma \
--        --file prisma/manual-migrations/2026-08-14_documentos_conteudo.sql
--  Depois: `npx prisma generate` (regenera o client com o novo modelo).
--
--  Idempotente: IF NOT EXISTS evita erro se rodar duas vezes.
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS `documentos_conteudo` (
  `documentoId`       VARCHAR(191) NOT NULL,
  `conteudo`          LONGBLOB     NOT NULL,
  `comprimido`        TINYINT(1)   NOT NULL DEFAULT 0,
  `tamanhoArmazenado` INT          NULL,
  PRIMARY KEY (`documentoId`),
  CONSTRAINT `documentos_conteudo_documentoId_fkey`
    FOREIGN KEY (`documentoId`) REFERENCES `documentos` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
