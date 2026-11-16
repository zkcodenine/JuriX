const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const logger = require('./config/logger');

const app = express();

// ─── Atras de proxy (HostGator/Apache/Passenger, Cloudflare) ───────
// Sem isto, req.ip seria sempre o IP do proxy: o rate limit trataria
// TODOS os usuarios como um so e o express-rate-limit ainda reclama do
// header X-Forwarded-For nao confiavel. 1 = confia no primeiro salto.
if (process.env.TRUST_PROXY !== 'false') {
  app.set('trust proxy', Number(process.env.TRUST_PROXY || 1));
}

// ─── Caminho base (subdiretorio do dominio) ────────────────────────
// Publicado em https://nossosflows.com.br/jurix, as requisicoes podem
// chegar com o prefixo /jurix (Apache + proxy) ou ja sem ele (Passenger
// com sub-URI, que define SCRIPT_NAME). Normalizar aqui faz as rotas
// funcionarem nos dois casos, sem duplicar cada `app.use`.
const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/+$/, '');
if (BASE_PATH) {
  app.use((req, _res, next) => {
    if (req.url === BASE_PATH) req.url = '/';
    else if (req.url.startsWith(BASE_PATH + '/')) req.url = req.url.slice(BASE_PATH.length);
    next();
  });
}

// ─── Segurança ─────────────────────────────────────
// Quando o backend serve o frontend (Electron/produção), desabilita o CSP
// do Helmet — o React build já é estático e a segurança real é via JWT.
// Em modo API-only, usa CSP restrito.
const servindoFrontend = process.env.SERVE_FRONTEND === 'true';

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: servindoFrontend
    ? false  // Frontend servido pelo mesmo origin — CSP via meta tag do HTML
    : {
        directives: {
          defaultSrc:  ["'self'"],
          scriptSrc:   ["'self'"],
          styleSrc:    ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
          fontSrc:     ["'self'", 'https://cdnjs.cloudflare.com'],
          imgSrc:      ["'self'", 'data:', 'blob:'],
          connectSrc:  ["'self'"],
        },
      },
}));

// Origens liberadas. Em producao, FRONTEND_URL aponta para o dominio
// publicado; EXTRA_ORIGINS aceita uma lista separada por virgula (www,
// dominio alternativo, app mobile em outro host).
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://localhost:3001', // Electron (frontend served pelo backend)
  ...(process.env.EXTRA_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),
];

app.use(cors({
  origin: (origin, cb) => {
    // Electron app (file:// ou sem origin) e origens permitidas
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origem não permitida'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Rate Limiting ─────────────────────────────────
// Use user ID (JWT) when available, falling back to IP.
// This avoids blocking all users behind the same NAT (university networks, 4G).
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 600,                  // generous — shared IPs won't block legitimate users
  keyGenerator: (req) => {
    try {
      const auth = req.headers.authorization;
      if (auth?.startsWith('Bearer ')) {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
        if (decoded?.id) return `user:${decoded.id}`;
      }
    } catch { /* fall through to IP */ }
    return req.ip;
  },
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
});
app.use('/api/', limiter);

// ─── Auth rate limit (login/registro) — por IP ─────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,   // increased — shared NAT IPs need higher limits
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/registrar', authLimiter);

// ─── Parsers ───────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Arquivos estáticos (storage local) ────────────
// Base única, compartilhada com o upload (config/storage.js). Antes cada lugar
// resolvia por conta própria e o upload acabava gravando fora daqui.
const { STORAGE_DIR: storageBase } = require('./config/storage');

// Avatares: acesso público (usados em perfis)
app.use('/storage/avatars', express.static(path.join(storageBase, 'avatars'), {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=60');
  },
}));

// Logos: acesso público (usados em cabeçalhos de documentos)
app.use('/storage/logos', express.static(path.join(storageBase, 'logos'), {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=60');
  },
}));

// Documentos: acesso restrito — só o dono pode acessar
app.use('/storage/documentos', (req, res, next) => {
  // Verifica JWT antes de servir o arquivo
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }
  try {
    const jwt = require('jsonwebtoken');
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // O path é /storage/documentos/{userId}/arquivo.ext
    // req.path aqui é /{userId}/arquivo.ext
    const pathUserId = req.path.split('/')[1];
    if (decoded.id !== pathUserId) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido.' });
  }
}, express.static(path.join(storageBase, 'documentos'), {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-cache');
  },
}));

// ─── Logging de requisições ────────────────────────
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// ─── Rotas ─────────────────────────────────────────
app.use('/api', routes);

// ─── Health check ──────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    sistema: 'JuriX',
    timestamp: new Date().toISOString(),
  });
});

// ─── Frontend estático (modo Electron/produção) ────
if (process.env.SERVE_FRONTEND === 'true') {
  const frontendDist =
    process.env.FRONTEND_DIST ||
    path.join(__dirname, '../../frontend/dist');

  // O index.html buildado referencia os assets com o caminho base
  // (/jurix/assets/...). Como as URLs ja foram normalizadas no topo, servir
  // a pasta na raiz atende os dois formatos.

  app.use(express.static(frontendDist, { index: false }));

  // SPA fallback — entrega index.html para qualquer rota não-API e não-arquivo
  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/storage') ||
      req.path === '/health' ||
      req.path.match(/\.\w+$/) // Skip file requests (.js, .css, .svg, etc.)
    ) {
      return next();
    }
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ─── 404 ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

// ─── Error handler global ──────────────────────────
app.use(errorHandler);

module.exports = app;
