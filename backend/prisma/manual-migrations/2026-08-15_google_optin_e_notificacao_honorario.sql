-- ══════════════════════════════════════════════════════════════════
--  Opt-in de Google Agenda (padrão ON) em tarefas/prazos/honorários, e
--  configuração de notificação de vencimento de parcela. Apenas ADD
--  COLUMN (aditivo). NÃO toca em nenhuma tabela cards_*.
--
--  Rode UMA VEZ:
--    npx prisma db execute --schema prisma/schema.prisma \
--        --file prisma/manual-migrations/2026-08-15_google_optin_e_notificacao_honorario.sql
--    npx prisma generate
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE `tarefas`
  ADD COLUMN `googleSync` TINYINT(1) NOT NULL DEFAULT 1;

ALTER TABLE `prazos`
  ADD COLUMN `googleSync` TINYINT(1) NOT NULL DEFAULT 1;

ALTER TABLE `honorarios`
  ADD COLUMN `googleSync` TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN `notificarVencimento` TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN `notificarDiasAntes` INT NOT NULL DEFAULT 3;

ALTER TABLE `parcelas`
  ADD COLUMN `googleEventId` VARCHAR(191) NULL;
