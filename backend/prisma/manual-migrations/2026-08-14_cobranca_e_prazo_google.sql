-- ══════════════════════════════════════════════════════════════════
--  Migração ADITIVA: colunas de cobrança em `processos` e googleEventId
--  em `prazos`. Apenas ADD COLUMN — nenhum DROP/ALTER destrutivo. As
--  tabelas cards_* do "Cards de Saúde" NÃO são tocadas.
--
--  Rode UMA VEZ:
--    npx prisma db execute --schema prisma/schema.prisma \
--        --file prisma/manual-migrations/2026-08-14_cobranca_e_prazo_google.sql
--    npx prisma generate
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE `processos`
  ADD COLUMN `cobrancaNome`     VARCHAR(191) NULL,
  ADD COLUMN `cobrancaEndereco` VARCHAR(191) NULL,
  ADD COLUMN `cobrancaWhatsapp` VARCHAR(191) NULL;

ALTER TABLE `prazos`
  ADD COLUMN `googleEventId` VARCHAR(191) NULL;
