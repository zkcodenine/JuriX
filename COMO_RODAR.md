# 🏛️ JuriX — Guia de Instalação e Execução

## Pré-requisitos
- Node.js 20+
- Docker + Docker Compose (recomendado)
- PostgreSQL 16 (se rodar sem Docker)
- Redis 7 (se rodar sem Docker)

---

## ▶️ Opção 1 — Docker (Recomendado)

```bash
# Na raiz do projeto
docker-compose up -d
```

Isso sobe automaticamente: PostgreSQL + Redis + Backend + Frontend

Acesse: http://localhost:3000

---

## ▶️ Opção 2 — Manual (Desenvolvimento)

### 1. Subir banco e redis com Docker
```bash
docker-compose up -d postgres redis
```

### 2. Configurar o Backend
```bash
cd backend
cp .env.example .env
# Edite o .env com suas configurações

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
- API Docs: http://localhost:3001/health

---

## 🗄️ Banco de dados

### Rodar migrations
```bash
cd backend
npx prisma migrate dev
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
| `DATABASE_URL` | URL do PostgreSQL |
| `REDIS_URL` | URL do Redis |
| `JWT_SECRET` | Chave secreta JWT (troque!) |
| `DATAJUD_API_KEY` | API Key do DataJud CNJ |
| `MERCADOPAGO_ACCESS_TOKEN` | Token do Mercado Pago |
| `RESEND_API_KEY` | API Key para envio de e-mails |

---

## 📁 Estrutura do Projeto

```
JuriX/
├── backend/                # API Node.js + Express + Prisma
│   ├── prisma/            # Schema e migrations do banco
│   ├── src/
│   │   ├── config/        # Database, Redis, Logger
│   │   ├── controllers/   # Lógica dos endpoints
│   │   ├── jobs/          # Agendamento (Process Monitor)
│   │   ├── middlewares/   # Auth JWT, Error handler, Audit
│   │   ├── routes/        # Definição de rotas
│   │   └── services/      # DataJud, Monitor, Notificações
│   └── package.json
├── frontend/               # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/    # Layout, Processo tabs, etc.
│   │   ├── pages/         # Dashboard, Processos, Auth, etc.
│   │   ├── services/      # API client (Axios)
│   │   ├── store/         # Zustand (auth)
│   │   └── utils/         # Formatters
│   └── package.json
├── storage/               # Documentos PDF (armazenamento local)
├── logs/                  # Logs do backend
├── docker-compose.yml
└── .env.example
```

---

## 🔌 Integração DataJud (CNJ)

A API Key já está configurada:
```
APIKey: cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
```

Fluxo de importação:
1. Usuário clica em **"Importar CNJ"** ou **"Vincular ao CNJ"**
2. Informa o número CNJ e o tribunal
3. Sistema consulta o DataJud em tempo real
4. Mostra preview dos dados para confirmação
5. Cria o processo com partes, advogados e movimentações
6. Ativa monitoramento automático a cada 3 horas

---

## 📡 APIs Disponíveis

```
POST   /api/auth/registrar
POST   /api/auth/login
GET    /api/auth/me

GET    /api/processos
POST   /api/processos
GET    /api/processos/:id
PUT    /api/processos/:id
DELETE /api/processos/:id
POST   /api/processos/importar-cnj
POST   /api/processos/:id/vincular-cnj
POST   /api/processos/:id/monitoramento/ativar
GET    /api/processos/:id/movimentacoes
GET    /api/processos/:id/tarefas
GET    /api/processos/:id/prazos
GET    /api/processos/:id/documentos
GET    /api/processos/:id/honorarios
GET    /api/processos/:id/anotacoes

GET    /api/tarefas
POST   /api/tarefas
PUT    /api/tarefas/:id
DELETE /api/tarefas/:id

POST   /api/documentos/upload
DELETE /api/documentos/:id

POST   /api/honorarios
PUT    /api/honorarios/:id/parcelas/:parcelaId

GET    /api/notificacoes
PATCH  /api/notificacoes/:id/ler
PATCH  /api/notificacoes/ler-todas

GET    /api/dashboard

GET    /api/pagamentos/planos
POST   /api/pagamentos/criar-preferencia
```

---

## 🔒 Segurança

- Autenticação JWT com expiração de 7 dias
- Rate limiting: 200 req/15min (geral), 10 req/15min (auth)
- Helmet.js para headers de segurança
- Logs de auditoria em todas operações de escrita
- CORS configurado apenas para o frontend
- Senhas com bcrypt (12 rounds)
- Dados de pagamento via Supabase + Mercado Pago (nunca no banco local)

---

## ⚠️ Sobre o StudyFlow (projeto anterior)

Os arquivos do StudyFlow estão em `codigo-fonte/`.
Você pode arquivá-los ou remover a pasta — o JuriX é completamente independente.
