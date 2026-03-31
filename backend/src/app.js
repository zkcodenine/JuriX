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

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3001', // Electron (frontend served pelo backend)
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
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
});
app.use('/api/', limiter);

// ─── Auth rate limit mais restrito ─────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/registrar', authLimiter);

// ─── Parsers ───────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Arquivos estáticos (storage local) ────────────
// Avatares: acesso público (usados em perfis)
app.use('/storage/avatars', express.static(path.join(__dirname, '../../storage/avatars'), {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=3600');
  },
}));

// Logos: acesso público (usados em cabeçalhos de documentos)
app.use('/storage/logos', express.static(path.join(__dirname, '../../storage/logos'), {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=3600');
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
}, express.static(path.join(__dirname, '../../storage/documentos'), {
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
