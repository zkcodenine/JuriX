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
