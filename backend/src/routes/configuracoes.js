const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const auth = require('../middlewares/auth');
const { prisma } = require('../config/database');

router.use(auth);

// ─── Upload de logo do escritório ─────────────────
const logoStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(process.env.STORAGE_PATH || './storage', 'logos');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, _file, cb) => {
    const ext = path.extname(_file.originalname).toLowerCase() || '.png';
    cb(null, `${req.usuario.id}${ext}`);
  },
});
const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Apenas imagens são permitidas.'));
  },
}).single('logo');

router.post('/escritorio/logo', (req, res) => {
  uploadLogo(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

    const logoUrl = `/storage/logos/${req.file.filename}`;

    // Save in config
    await prisma.configuracao.upsert({
      where: { usuarioId_chave: { usuarioId: req.usuario.id, chave: 'logoEscritorio' } },
      create: { usuarioId: req.usuario.id, chave: 'logoEscritorio', valor: logoUrl },
      update: { valor: logoUrl },
    });

    res.json({ logo: logoUrl });
  });
});

// ─── GET /configuracoes/escritorio ─────────────────
// Retorna todas as chaves do escritório como objeto
router.get('/escritorio', async (req, res, next) => {
  try {
    const rows = await prisma.configuracao.findMany({
      where: { usuarioId: req.usuario.id },
    });
    const config = {};
    for (const r of rows) config[r.chave] = r.valor;
    res.json(config);
  } catch (err) { next(err); }
});

// ─── PUT /configuracoes/escritorio ─────────────────
// Upserts múltiplas chaves de uma vez
router.put('/escritorio', async (req, res, next) => {
  try {
    const campos = req.body;
    const ops = Object.entries(campos).map(([chave, valor]) =>
      prisma.configuracao.upsert({
        where: { usuarioId_chave: { usuarioId: req.usuario.id, chave } },
        create: { usuarioId: req.usuario.id, chave, valor: String(valor ?? '') },
        update: { valor: String(valor ?? '') },
      })
    );
    await Promise.all(ops);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── GET /configuracoes/modelos ─────────────────────
router.get('/modelos', async (req, res, next) => {
  try {
    const modelos = await prisma.modeloDocumento.findMany({
      where: { usuarioId: req.usuario.id },
      orderBy: { criadoEm: 'desc' },
    });
    res.json(modelos);
  } catch (err) { next(err); }
});

// ─── POST /configuracoes/modelos ────────────────────
router.post('/modelos', async (req, res, next) => {
  try {
    const { nome, descricao, conteudo, categoria } = req.body;
    const modelo = await prisma.modeloDocumento.create({
      data: { usuarioId: req.usuario.id, nome, descricao: descricao || null, conteudo, categoria: categoria || null },
    });
    res.status(201).json(modelo);
  } catch (err) { next(err); }
});

// ─── PUT /configuracoes/modelos/:id ─────────────────
router.put('/modelos/:id', async (req, res, next) => {
  try {
    const { nome, descricao, conteudo, categoria } = req.body;
    const modelo = await prisma.modeloDocumento.updateMany({
      where: { id: req.params.id, usuarioId: req.usuario.id },
      data: { nome, descricao: descricao || null, conteudo, categoria: categoria || null },
    });
    res.json(modelo);
  } catch (err) { next(err); }
});

// ─── DELETE /configuracoes/modelos/:id ──────────────
router.delete('/modelos/:id', async (req, res, next) => {
  try {
    await prisma.modeloDocumento.deleteMany({
      where: { id: req.params.id, usuarioId: req.usuario.id },
    });
    res.json({ mensagem: 'Modelo excluído.' });
  } catch (err) { next(err); }
});

module.exports = router;
