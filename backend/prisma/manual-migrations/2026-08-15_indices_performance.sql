-- ══════════════════════════════════════════════════════════════════
--  Índices compostos de performance — casam com os padrões de consulta
--  reais (where + orderBy). Apenas CREATE INDEX (aditivo). NÃO toca em
--  nenhuma tabela cards_* do "Cards de Saúde".
--
--  Ganho real só aparece quando as tabelas crescerem (hoje têm poucas
--  linhas). O índice de movimentacoes(processoId, data) é o mais
--  importante — é a consulta mais quente do sistema.
--
--  Rode UMA VEZ:
--    npx prisma db execute --schema prisma/schema.prisma \
--        --file prisma/manual-migrations/2026-08-15_indices_performance.sql
--    npx prisma generate
-- ══════════════════════════════════════════════════════════════════

-- Movimentações por processo, mais recentes primeiro (tela do processo).
CREATE INDEX `movimentacoes_processoId_data_idx` ON `movimentacoes` (`processoId`, `data`);

-- Tarefas por usuário filtradas por status (listagem de Tarefas).
CREATE INDEX `tarefas_usuarioId_status_idx` ON `tarefas` (`usuarioId`, `status`);

-- Prazos pendentes por vencimento (job diário de alertas).
CREATE INDEX `prazos_status_dataVencimento_idx` ON `prazos` (`status`, `dataVencimento`);

-- Parcelas em aberto por vencimento (job de alertas de honorário).
CREATE INDEX `parcelas_status_vencimento_idx` ON `parcelas` (`status`, `vencimento`);

-- Notificações do usuário, mais recentes primeiro (sino / central).
CREATE INDEX `notificacoes_usuarioId_criadoEm_idx` ON `notificacoes` (`usuarioId`, `criadoEm`);

-- Processos do dono, mais recentes primeiro (listagem de Processos).
CREATE INDEX `processos_usuarioId_criadoEm_idx` ON `processos` (`usuarioId`, `criadoEm`);
