const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middlewares/auth');
const { prisma } = require('../config/database');

router.use(auth);

// ─── Configuração do Multer ────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../../storage/documentos', req.usuario.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB || '50')) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.xlsx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('Tipo de arquivo não permitido.'));
    }
    cb(null, true);
  },
});

// POST /api/documentos/upload
router.post('/upload', upload.single('arquivo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Arquivo não enviado.' });

    const { processoId, nome, descricao } = req.body;

    // Verifica se o processo pertence ao usuário
    const processo = await prisma.processo.findFirst({
      where: { id: processoId, usuarioId: req.usuario.id },
    });
    if (!processo) {
      // Remove arquivo físico que já foi salvo pelo multer
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Processo não encontrado.' });
    }

    const arquivoPath = `/storage/documentos/${req.usuario.id}/${req.file.filename}`;

    const documento = await prisma.documento.create({
      data: {
        processoId,
        nome: nome || req.file.originalname,
        arquivo: arquivoPath,
        tamanho: req.file.size,
        mimeType: req.file.mimetype,
        descricao,
      },
    });

    res.status(201).json(documento);
  } catch (err) { next(err); }
});

// GET /api/documentos/:id/arquivo — Stream autenticado do arquivo
// Resolve o problema de 401 em <iframe src> e <img src> que não enviam
// o header Authorization. O frontend chama via axios (que injeta o token),
// recebe o arquivo como blob e cria uma URL temporária (URL.createObjectURL).
router.get('/:id/arquivo', async (req, res, next) => {
  try {
    const doc = await prisma.documento.findFirst({
      where: { id: req.params.id, processo: { usuarioId: req.usuario.id } },
    });
    if (!doc) return res.status(404).json({ error: 'Documento não encontrado.' });

    const filePath = path.join(__dirname, '../../../', doc.arquivo);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado no disco.' });
    }

    // Define headers para o tipo do arquivo
    const mimeType = doc.mimeType || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.nome)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=300');

    if (doc.tamanho) {
      res.setHeader('Content-Length', doc.tamanho);
    }

    // Stream o arquivo para a resposta
    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erro ao ler arquivo.' });
      }
    });
    stream.pipe(res);
  } catch (err) { next(err); }
});

// PUT /api/documentos/:id — Renomear documento
router.put('/:id', async (req, res, next) => {
  try {
    const doc = await prisma.documento.findFirst({
      where: { id: req.params.id, processo: { usuarioId: req.usuario.id } },
    });
    if (!doc) return res.status(404).json({ error: 'Documento não encontrado.' });

    const { nome } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome é obrigatório.' });

    const updated = await prisma.documento.update({
      where: { id: req.params.id },
      data: { nome: nome.trim() },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/documentos/:id
router.delete('/:id', async (req, res, next) => {
  try {
    // Verifica se o documento pertence a um processo do usuário
    const doc = await prisma.documento.findFirst({
      where: { id: req.params.id, processo: { usuarioId: req.usuario.id } },
    });
    if (!doc) return res.status(404).json({ error: 'Documento não encontrado.' });

    // Remove arquivo físico
    const filePath = path.join(__dirname, '../../../', doc.arquivo);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await prisma.documento.delete({ where: { id: req.params.id } });
    res.json({ mensagem: 'Documento excluído.' });
  } catch (err) { next(err); }
});

module.exports = router;
