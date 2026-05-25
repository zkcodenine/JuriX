# 🚚 Migração JuriX — Supabase (PostgreSQL) → HostGator (MySQL)

Este guia descreve, passo a passo, como migrar o JuriX da Supabase para o MySQL da HostGator, preservando todos os dados.

---

## 📋 Antes de começar

- [ ] Plano HostGator com MySQL ativo
- [ ] Acesso ao cPanel da HostGator
- [ ] URL atual do Supabase em mãos (campo `LEGACY_SUPABASE_URL` no `.env`)
- [ ] Backup dos arquivos em `storage/` (documentos PDF anexados aos processos)

---

## 1️⃣  Criar o banco MySQL no cPanel

1. cPanel → **MySQL Databases**
2. Em **Create New Database**:
   - Nome: `jurix` (o cPanel adicionará o prefixo do seu usuário, ex: `cpaneluser_jurix`)
3. Em **MySQL Users → Add New User**:
   - Usuário: `jurix`
   - Senha: gere uma senha forte (anote!)
4. Em **Add User To Database**:
   - User: `cpaneluser_jurix`
   - Database: `cpaneluser_jurix`
   - Privileges: marque **ALL PRIVILEGES**

## 2️⃣  Liberar conexão remota

1. cPanel → **Remote MySQL**
2. Adicione o IP do servidor que rodará o JuriX em **Add Access Host**
3. (Opcional) Use `%` para liberar qualquer IP — **menos seguro**, evite em produção

> Sem este passo, o Prisma não conseguirá conectar. Erro típico: `Host '...' is not allowed to connect to this MySQL server`.

## 3️⃣  Exportar dados do Supabase

Garanta que `backend/.env` tem `LEGACY_SUPABASE_URL` apontando para o Supabase antigo:

```env
LEGACY_SUPABASE_URL=postgresql://postgres.xxx:senha@aws-x-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

Instale o driver PostgreSQL (apenas para o export) e rode:

```bash
cd backend
npm install pg --no-save
cd ..
node scripts/export-supabase.js
```

Saída esperada:

```
→ Conectando ao Supabase (PostgreSQL)...
  ✓ usuarios                  3 registros → backup/supabase_dump/usuarios.json
  ✓ processos                12 registros → backup/supabase_dump/processos.json
  ...
✓ Export concluído.
```

Os JSONs ficam em `backup/supabase_dump/`.

## 4️⃣  Apontar `.env` para HostGator

Edite `backend/.env`:

```env
DATABASE_URL=mysql://cpaneluser_jurix:SUA_SENHA@SEU_HOST.hostgator.com.br:3306/cpaneluser_jurix
```

Como descobrir `SEU_HOST`:
- Use o domínio do site, ex: `seudominio.com.br`
- Ou consulte cPanel → **MySQL Databases** → "Servers" no topo

## 5️⃣  Criar as tabelas no MySQL

```bash
cd backend
npx prisma db push
```

Esse comando lê o `schema.prisma` (já em modo MySQL) e cria todas as tabelas.

Para verificar:
```bash
npx prisma studio
```

## 6️⃣  Importar os dados

```bash
node scripts/import-hostgator.js
```

Saída esperada:
```
→ Importando dados para o MySQL HostGator...
  ✓ usuarios.json              3 inseridos, 0 pulados
  ✓ processos.json            12 inseridos, 0 pulados
  ...
✓ Importação concluída.
```

Registros marcados como "pulados" são duplicados (já existiam) ou órfãos (com chave estrangeira inválida). O resumo é salvo em `backup/supabase_dump/_import_summary.json`.

## 7️⃣  Testar

```bash
cd backend
npm run dev
```

Em outro terminal:
```bash
cd frontend
npm run dev
```

Acesse http://localhost:3000 e valide:
- Login funciona
- Processos listados
- Movimentações exibidas
- Tarefas e prazos preservados
- Documentos anexados acessíveis (verifique se `storage/` está intacto)

## 8️⃣  Limpar (opcional)

Após confirmar que está tudo funcionando:

- Apagar `LEGACY_SUPABASE_URL` de `backend/.env`
- Remover `pg` do backend: `cd backend && npm uninstall pg`
- Cancelar/desativar o projeto Supabase
- Arquivar `backup/supabase_dump/` em local seguro

---

## 🔎 Troubleshooting

| Erro | Causa provável | Solução |
|------|----------------|---------|
| `Host '...' is not allowed to connect` | IP não liberado | cPanel → Remote MySQL → adicionar IP |
| `Access denied for user '...'` | Senha errada ou usuário sem permissão | Verifique senha e privilégios `ALL PRIVILEGES` |
| `Unknown database '...'` | Nome do DB sem prefixo cPanel | Use o nome completo: `cpaneluser_jurix` |
| `P2002: Unique constraint` no import | Registro duplicado | Normal se rodou o import 2x; o script pula automaticamente |
| `Data too long for column` | Texto maior que VARCHAR padrão | Edite o `schema.prisma` adicionando `@db.Text` no campo |
| `ER_NOT_SUPPORTED_AUTH_MODE` | MySQL 8 com autenticação caching_sha2 | Garante MySQL 5.7+ ou ative `mysql_native_password` no usuário |

---

## 🔐 Sobre RLS (Row Level Security)

O Supabase oferece RLS nativo via PostgreSQL. O MySQL HostGator **não** oferece RLS.

A autorização do JuriX já é feita 100% no backend (middleware JWT + checagem de `usuarioId` em todas as queries Prisma). Portanto, **nenhuma mudança de código** é necessária para manter a segurança.

O arquivo antigo `legacy/supabase_rls_policies.sql` é apenas referência histórica.
