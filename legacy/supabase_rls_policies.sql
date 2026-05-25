-- ═══════════════════════════════════════════════════════════════
--  JuriX — Row Level Security (RLS) Policies
--  Execute no Supabase: Dashboard → SQL Editor
--
--  OBJETIVO: Garantir que NENHUM usuário externo consiga
--  acessar diretamente os dados de outro usuário via API do
--  Supabase (REST ou GraphQL), mesmo com a anon key.
--
--  NOTA: O backend JuriX usa a SERVICE_ROLE (bypassa RLS),
--  portanto as queries do backend NÃO são afetadas.
--  O RLS é uma camada extra de proteção (defesa em profundidade).
-- ═══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
--  PASSO 1: Habilitar RLS em TODAS as tabelas
-- ══════════════════════════════════════════════════════════════

ALTER TABLE usuarios              ENABLE ROW LEVEL SECURITY;
ALTER TABLE processos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE partes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE advogados_processo    ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarefas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtarefas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE prazos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE honorarios            ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE anotacoes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelos_documento    ENABLE ROW LEVEL SECURITY;
ALTER TABLE etiquetas_agenda      ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_agenda        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════
--  PASSO 2: Revogar acesso das roles anon e authenticated
--  Isso bloqueia acesso via REST API / PostgREST / GraphQL
-- ══════════════════════════════════════════════════════════════

REVOKE ALL ON TABLE usuarios              FROM anon, authenticated;
REVOKE ALL ON TABLE processos             FROM anon, authenticated;
REVOKE ALL ON TABLE partes                FROM anon, authenticated;
REVOKE ALL ON TABLE advogados_processo    FROM anon, authenticated;
REVOKE ALL ON TABLE movimentacoes         FROM anon, authenticated;
REVOKE ALL ON TABLE tarefas               FROM anon, authenticated;
REVOKE ALL ON TABLE subtarefas            FROM anon, authenticated;
REVOKE ALL ON TABLE prazos                FROM anon, authenticated;
REVOKE ALL ON TABLE documentos            FROM anon, authenticated;
REVOKE ALL ON TABLE honorarios            FROM anon, authenticated;
REVOKE ALL ON TABLE parcelas              FROM anon, authenticated;
REVOKE ALL ON TABLE anotacoes             FROM anon, authenticated;
REVOKE ALL ON TABLE notificacoes          FROM anon, authenticated;
REVOKE ALL ON TABLE configuracoes         FROM anon, authenticated;
REVOKE ALL ON TABLE modelos_documento    FROM anon, authenticated;
REVOKE ALL ON TABLE etiquetas_agenda      FROM anon, authenticated;
REVOKE ALL ON TABLE eventos_agenda        FROM anon, authenticated;
REVOKE ALL ON TABLE audit_logs            FROM anon, authenticated;

-- ══════════════════════════════════════════════════════════════
--  PASSO 3: Políticas restritivas — NEGAR TUDO para anon
--  (Com RLS habilitado e sem policies, acesso já é negado.
--   Mas criamos policies explícitas de DENY para clareza.)
-- ══════════════════════════════════════════════════════════════

-- Sem nenhuma policy = acesso negado para todos exceto service_role.
-- O backend usa service_role via Prisma e não é afetado.

-- ══════════════════════════════════════════════════════════════
--  PASSO 4: Forçar RLS mesmo para o table owner (postgres)
--  Isso é CRÍTICO — sem isso, o dono da tabela bypassa RLS
-- ══════════════════════════════════════════════════════════════

ALTER TABLE usuarios              FORCE ROW LEVEL SECURITY;
ALTER TABLE processos             FORCE ROW LEVEL SECURITY;
ALTER TABLE partes                FORCE ROW LEVEL SECURITY;
ALTER TABLE advogados_processo    FORCE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes         FORCE ROW LEVEL SECURITY;
ALTER TABLE tarefas               FORCE ROW LEVEL SECURITY;
ALTER TABLE subtarefas            FORCE ROW LEVEL SECURITY;
ALTER TABLE prazos                FORCE ROW LEVEL SECURITY;
ALTER TABLE documentos            FORCE ROW LEVEL SECURITY;
ALTER TABLE honorarios            FORCE ROW LEVEL SECURITY;
ALTER TABLE parcelas              FORCE ROW LEVEL SECURITY;
ALTER TABLE anotacoes             FORCE ROW LEVEL SECURITY;
ALTER TABLE notificacoes          FORCE ROW LEVEL SECURITY;
ALTER TABLE configuracoes         FORCE ROW LEVEL SECURITY;
ALTER TABLE modelos_documento    FORCE ROW LEVEL SECURITY;
ALTER TABLE etiquetas_agenda      FORCE ROW LEVEL SECURITY;
ALTER TABLE eventos_agenda        FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            FORCE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════
--  PASSO 5: Permitir acesso APENAS para service_role
--  (A role que o backend Prisma usa para se conectar)
-- ══════════════════════════════════════════════════════════════

-- service_role já bypassa RLS automaticamente no Supabase.
-- Mas garantimos via GRANT explícito:

GRANT ALL ON TABLE usuarios              TO service_role;
GRANT ALL ON TABLE processos             TO service_role;
GRANT ALL ON TABLE partes                TO service_role;
GRANT ALL ON TABLE advogados_processo    TO service_role;
GRANT ALL ON TABLE movimentacoes         TO service_role;
GRANT ALL ON TABLE tarefas               TO service_role;
GRANT ALL ON TABLE subtarefas            TO service_role;
GRANT ALL ON TABLE prazos                TO service_role;
GRANT ALL ON TABLE documentos            TO service_role;
GRANT ALL ON TABLE honorarios            TO service_role;
GRANT ALL ON TABLE parcelas              TO service_role;
GRANT ALL ON TABLE anotacoes             TO service_role;
GRANT ALL ON TABLE notificacoes          TO service_role;
GRANT ALL ON TABLE configuracoes         TO service_role;
GRANT ALL ON TABLE modelos_documento    TO service_role;
GRANT ALL ON TABLE etiquetas_agenda      TO service_role;
GRANT ALL ON TABLE eventos_agenda        TO service_role;
GRANT ALL ON TABLE audit_logs            TO service_role;

-- ══════════════════════════════════════════════════════════════
--  PASSO 6: Revogar acesso a sequences (previne INSERT via REST)
-- ══════════════════════════════════════════════════════════════

REVOKE USAGE ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
GRANT  USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ══════════════════════════════════════════════════════════════
--  PASSO 7: Verificação — rode depois de aplicar tudo
-- ══════════════════════════════════════════════════════════════

-- Verificar se RLS está ativo em todas as tabelas:
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Verificar policies criadas:
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;

-- Verificar grants (deve mostrar NENHUM para anon/authenticated):
SELECT grantee, table_name, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee;
