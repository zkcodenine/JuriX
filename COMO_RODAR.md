# 🏛️ JuriX — Guia de Instalação e Execução

## Pré-requisitos
- Node.js 20+
- Docker + Docker Compose (recomendado para desenvolvimento)
- MySQL 8.0 (se rodar sem Docker, ou via HostGator em produção)
- Redis 7 (opcional — fallback para cache em memória)

---

## ▶️ Opção 1 — Docker (Recomendado para desenvolvimento)

```bash
# Na raiz do projeto
docker-compose up -d
```

Isso sobe automaticamente: MySQL + Redis + Backend + Frontend

Acesse: http://localhost:3000

---

## ▶️ Opção 2 — Manual (Desenvolvimento)

### 1. Subir banco e redis com Docker
```bash
docker-compose up -d mysql redis
```

### 2. Configurar o Backend
```bash
cd backend
cp .env.example .env
# Edite o .env com suas configurações (DATABASE_URL apontando para MySQL)

npm install
npx prisma migrate dev --name init
npx prisma generate
npm run dev
```

### 3. Configurar o Frontend
```bash
cd frontend
npm install
npm run dev
```

### Acessar
- Frontend: http://localhost:3000
- API:      http://localhost:3001
- Health:   http://localhost:3001/health

---

## ☁️ Produção — HostGator MySQL

### Passos no cPanel
1. **MySQL Databases**
   - Crie o banco (ex: `cpaneluser_jurix`)
   - Crie um usuário com senha forte
   - Associe o usuário ao banco com `ALL PRIVILEGES`

2. **Remote MySQL** (essencial)
   - Adicione o IP do servidor que rodará o JuriX
   - Use `%` apenas se precisar liberar qualquer IP (menos seguro)

3. **Configuração local**
   - Edite `backend/.env` e preencha:
     ```
     DATABASE_URL=mysql://USUARIO:SENHA@HOST:3306/BANCO
     ```
   - Rode as migrations:
     ```bash
     cd backend
     npx prisma db push
     ```

### Migrando do Supabase
Veja o guia completo: [MIGRACAO_HOSTGATOR.md](MIGRACAO_HOSTGATOR.md)

---

## 🗄️ Banco de dados

### Rodar migrations
```bash
cd backend
npx prisma migrate dev
```

### Aplicar schema sem migration (HostGator)
```bash
cd backend
npx prisma db push
```

### Abrir Prisma Studio (interface visual do BD)
```bash
cd backend
npx prisma studio
```

---

## ⚙️ Variáveis de ambiente importantes

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | URL do MySQL HostGator (`mysql://user:pass@host:3306/db`) |
| `REDIS_URL` | URL do Redis (opcional) |
| `JWT_SECRET` | Chave secreta JWT (troque!) |
| `DATAJUD_API_KEY` | API Key do DataJud CNJ |
| `MERCADOPAGO_ACCESS_TOKEN` | Token do Mercado Pago |
| `RESEND_API_KEY` | API Key para envio de e-mails |
| `LEGACY_SUPABASE_URL` | (Só durante migração) URL do PostgreSQL Supabase antigo |

---

## 📁 Estrutura do Projeto

```
JuriX/
├── backend/                # API Node.js + Express + Prisma (MySQL)
│   ├── prisma/
│   │   ├── schema.prisma                  # Schema MySQL (HostGator)
│   │   └── migrations_postgresql_legacy/  # Migrations antigas (Supabase) — referência
│   ├── src/
│   │   ├── config/        # Database, Redis, Logger
│   │   ├── controllers/   # Lógica dos endpoints
│   │   ├── jobs/          # Process Monitor
│   │   ├── middlewares/   # Auth JWT, Error handler, Audit
│   │   ├── routes/        # Definição de rotas
│   │   └── services/      # DataJud, Monitor, Notificações
│   └── package.json
├── frontend/               # React + Vite + Tailwind
├── scripts/
│   ├── export-supabase.js  # Exporta dados do Supabase para JSON
│   ├── import-hostgator.js # Importa JSON para o MySQL HostGator
│   ├── process-icon.js
│   └── update-logo.js
├── legacy/                # Artefatos do Supabase (RLS policies)
├── storage/               # Documentos PDF (armazenamento local)
├── logs/                  # Logs do backend
├── docker-compose.yml     # Stack de desenvolvimento (MySQL + Redis + Back + Front)
└── .env.example
```

---

## 🔌 Integração DataJud (CNJ)

A API Key já está configurada. Fluxo de importação:
1. Usuário clica em **"Importar CNJ"** ou **"Vincular ao CNJ"**
2. Informa o número CNJ e o tribunal
3. Sistema consulta o DataJud em tempo real
4. Mostra preview dos dados para confirmação
5. Cria o processo com partes, advogados e movimentações
6. Ativa monitoramento automático a cada 30 minutos

---

## 🔒 Segurança

- Autenticação JWT com expiração de 7 dias
- Rate limiting: 200 req/15min (geral), 10 req/15min (auth)
- Helmet.js para headers de segurança
- Logs de auditoria em todas operações de escrita
- CORS configurado apenas para o frontend
- Senhas com bcrypt (12 rounds)
- Autorização 100% no backend via JWT/middleware (MySQL não tem RLS nativo como o Supabase)
