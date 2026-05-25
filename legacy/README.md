# Legacy — Artefatos Supabase

Esta pasta contém arquivos do antigo provedor Supabase (PostgreSQL), preservados apenas para referência histórica. **Não são utilizados pela aplicação atual**, que opera sobre MySQL HostGator.

## Conteúdo

- `supabase_rls_policies.sql` — Políticas de Row Level Security aplicadas no Supabase. Não aplicável a MySQL HostGator (que não tem RLS nativo; a autorização é feita 100% no backend via JWT/middleware).

## Migrações PostgreSQL antigas

As migrations Prisma originais (PostgreSQL) foram movidas para:
`backend/prisma/migrations_postgresql_legacy/`

Para o MySQL HostGator, gere uma nova migration inicial com:

```bash
cd backend
npx prisma migrate dev --name init_mysql
```

Ou, se preferir aplicar o schema sem versionamento:

```bash
npx prisma db push
```
