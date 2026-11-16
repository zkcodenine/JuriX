# 🌐 Publicar o JuriX na HostGator

Destino: **https://nossosflows.com.br/jurix**

O JuriX web é **um app Node só**: o backend Express serve a API *e* o React já
compilado. Não há Apache servindo arquivos por fora — assim o SPA, o `/api` e o
`/storage` ficam na mesma origem e não existe CORS entre eles.

---

## 0. Antes de começar

- [ ] Plano HostGator com **Setup Node.js App** no cPanel (Node 18+)
- [ ] Banco MySQL já criado (ver `MIGRACAO_HOSTGATOR.md`)
- [ ] Acesso SSH ou ao **Terminal** do cPanel (para rodar `npm install` e as migrações)

---

## 1. Gerar o pacote (na sua máquina)

```powershell
.\build-web.ps1
```

Isso cria `deploy-web\` com:

```
deploy-web/
  app.js                 ← arquivo de entrada do Passenger
  backend/               ← API (sem node_modules, sem .env)
    .env.example
  frontend/dist/         ← React compilado com base /jurix/
  scripts/               ← criar-admin.js, ativar-plano.js
  DEPLOY-HOSTGATOR.md
```

O script **falha de propósito** se o `index.html` não apontar para `/jurix/` —
é o erro que deixaria o site em branco no servidor.

---

## 2. Enviar para o servidor

Suba o conteúdo de `deploy-web/` para uma pasta **fora** do `public_html`:

```
/home/USUARIO/jurix-app/
```

> Por que fora do `public_html`: assim ninguém baixa o `.env`, o código ou os
> documentos dos clientes digitando a URL direta. Quem publica é o Passenger.

Crie também as pastas de dados (fora do `public_html` igualmente):

```bash
mkdir -p ~/jurix-storage ~/jurix-logs
```

---

## 3. Criar o app Node no cPanel

**cPanel → Setup Node.js App → Create Application**

| Campo | Valor |
|---|---|
| Node.js version | 18.x ou superior |
| Application mode | Production |
| Application root | `jurix-app` |
| Application URL | `nossosflows.com.br/jurix` |
| Application startup file | `app.js` |

Clique em **Create**. O cPanel cria o `.htaccess` do subdiretório sozinho.

---

## 4. Configurar o `.env`

No servidor:

```bash
cd ~/jurix-app/backend
cp .env.example .env
nano .env
```

Preencha com atenção:

- `DATABASE_URL` → use `localhost` como host (o banco está na mesma máquina)
- `JWT_SECRET` → **gere um novo**, não reaproveite o de desenvolvimento:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `BASE_PATH=/jurix` → tem que bater com o `VITE_BASE_PATH` do frontend
- `STORAGE_PATH=/home/USUARIO/jurix-storage`
- `LOG_PATH=/home/USUARIO/jurix-logs`
- `FRONTEND_URL=https://nossosflows.com.br`
- `TRUST_PROXY=1`

---

## 5. Instalar dependências e preparar o banco

Use o **Terminal do cPanel** (ou SSH). Primeiro entre no ambiente do Node — o
botão **"Run JS script"** / a linha `source .../bin/activate` aparece na tela do
app no cPanel:

```bash
source /home/USUARIO/nodevenv/jurix-app/18/bin/activate
cd ~/jurix-app/backend
npm install --omit=dev
npx prisma generate
npx prisma db push
```

> `npm install` precisa rodar **no servidor**: o Prisma baixa o motor de
> consulta compilado para Linux. Copiar o `node_modules` do Windows não funciona.

---

## 6. Criar o administrador

```bash
cd ~/jurix-app
node scripts/criar-admin.js seu-email@dominio.com 'SenhaForte123!' 'Seu Nome'
```

O script já grava a senha com bcrypt e confirma que o login funciona. **Nunca**
insira usuário direto pelo phpMyAdmin: senha em texto puro nunca passa no
`bcrypt.compare()` e tranca todo mundo para fora.

---

## 7. Reiniciar e testar

**cPanel → Setup Node.js App → Restart**

Depois confira, nesta ordem:

| Verificação | URL / ação | Esperado |
|---|---|---|
| Backend no ar | `https://nossosflows.com.br/jurix/health` | JSON com `"status":"ok"` |
| Frontend carrega | `https://nossosflows.com.br/jurix` | tela de login |
| Assets | DevTools → Network | tudo em `/jurix/assets/...`, nenhum 404 |
| Login | entre com o admin | abre o dashboard |
| Rota direta | `https://nossosflows.com.br/jurix/processos` | abre (não dá 404) |

---

## 8. Google Agenda

No **Google Cloud Console → Credentials → OAuth client → Authorized redirect URIs**,
adicione exatamente:

```
https://nossosflows.com.br/jurix/api/google/callback
```

E no `.env`:

```env
GOOGLE_REDIRECT_URI=https://nossosflows.com.br/jurix/api/google/callback
```

Depois de conectar a conta, o JuriX envia sozinho para a Google Agenda tudo que
já estava salvo (eventos, prazos de tarefa, prazos processuais e vencimentos).
Dá para repetir a qualquer momento em **Perfil → Integrações → Sincronizar agora**.

---

## 9. O app desktop continua funcionando

O Electron **não muda**: `npm run build` (na raiz) segue compilando o frontend
com base `/` e empacotando o backend junto. Os dois modos usam o mesmo código;
só o `VITE_BASE_PATH` difere, e ele mora em `frontend/.env.web`, lido apenas
pelo `build:web`.

---

## 🔎 Problemas comuns

| Sintoma | Causa | Solução |
|---|---|---|
| Página branca, 404 em `/assets/...` | build feito sem o modo web | rode `npm run build:web` (ou `.\build-web.ps1`) |
| `/jurix/processos` dá 404 do Apache | Application URL errada no cPanel | precisa ser `nossosflows.com.br/jurix` |
| `PrismaClientInitializationError` | `node_modules` copiado do Windows | apague e rode `npm install` no servidor |
| Login falha com a senha certa | usuário criado pelo phpMyAdmin | recrie com `scripts/criar-admin.js` |
| Todos os usuários tomam rate limit juntos | `TRUST_PROXY` não configurado | `TRUST_PROXY=1` no `.env` e reinicie |
| Erro de CORS | domínio fora da lista | ajuste `FRONTEND_URL` / `EXTRA_ORIGINS` |
| Google volta com `redirect_uri_mismatch` | URI não cadastrada | copie a URI do passo 8, caractere por caractere |
| Documentos somem após atualizar | `STORAGE_PATH` dentro da pasta do app | aponte para `/home/USUARIO/jurix-storage` |

---

## 🔐 Antes de abrir para os clientes

- [ ] `JWT_SECRET` novo, diferente do de desenvolvimento
- [ ] `.env` fora do `public_html` e com permissão `600`
- [ ] `STORAGE_PATH` e `LOG_PATH` fora do `public_html`
- [ ] HTTPS ativo (cPanel → SSL/TLS Status → AutoSSL)
- [ ] Backup automático do MySQL agendado no cPanel
- [ ] Testes de regressão verdes contra o servidor:
      `node backend/testes/executar.js --base https://nossosflows.com.br/jurix/api`
