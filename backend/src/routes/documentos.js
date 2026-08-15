const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const auth = require('../middlewares/auth');
const { planoAtivo } = require('../middlewares/requerPlanoPago');
const { prisma } = require('../config/database');
const { caminhoDoDocumento } = require('../config/storage');
const notificationService = require('../services/notificationService');
const { whereProcessoVisivel, whereProcessoEditavel } = require('../utils/acessoProcesso');

router.use(auth);

// Limite de armazenamento total do plano gratuito (500 MB).
const LIMITE_STORAGE_FREE = 500 * 1024 * 1024;

// Teto por arquivo. Os bytes vão para o MySQL, então o limite real é o
// `max_allowed_packet` do servidor (na HostGator costuma ser 16-64 MB). 25 MB
// é conservador; se precisar de arquivos maiores, suba o max_allowed_packet no
// banco E este valor via MAX_FILE_SIZE_MB.
const MAX_FILE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '25', 10);

// ─── Configuração do Multer ────────────────────────
// memoryStorage: o arquivo chega como Buffer em memória e vai direto para o
// banco (comprimido). Nada é gravado no disco local — era isso que fazia o
// anexo "sumir" para os outros usuários de um processo compartilhado.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.xlsx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('Tipo de arquivo não permitido.'));
    }
    cb(null, true);
  },
});

// Compressão SEM PERDA (lossless). Documentos jurídicos não podem ser
// degradados, então nada de recompressão com perda. O gzip encolhe bem
// PDF-texto, docx, xlsx e txt; formatos já comprimidos (jpg/png/muitos PDFs)
// não encolhem — nesse caso guardamos os bytes crus (comprimido=false) para
// não gastar CPU à toa nem inflar o dado.
function comprimirParaArmazenar(buffer) {
  try {
    const gz = zlib.gzipSync(buffer, { level: zlib.constants.Z_BEST_COMPRESSION });
    if (gz.length < buffer.length * 0.95) {
      return { conteudo: gz, comprimido: true };
    }
  } catch { /* cai no cru */ }
  return { conteudo: buffer, comprimido: false };
}

function descomprimir(row) {
  if (!row) return null;
  return row.comprimido ? zlib.gunzipSync(row.conteudo) : row.conteudo;
}

// POST /api/documentos/upload
router.post('/upload', upload.single('arquivo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Arquivo não enviado.' });

    const { processoId, nome, descricao } = req.body;

    // Só quem pode EDITAR o processo (dono ou compartilhado com edição) anexa.
    const processo = await prisma.processo.findFirst({
      where: { id: processoId, ...whereProcessoEditavel(req.usuario.id) },
      select: { id: true, numero: true, numeroCnj: true, usuarioId: true },
    });
    if (!processo) {
      // Nada foi gravado em disco (memoryStorage) — só descartar o buffer.
      return res.status(404).json({ error: 'Processo não encontrado.' });
    }

    // Plano gratuito: limite de 500MB de armazenamento total (pelo tamanho
    // original, que é o que o usuário enxerga).
    if (!planoAtivo(req.usuario)) {
      const agg = await prisma.documento.aggregate({
        _sum: { tamanho: true },
        where: { processo: { usuarioId: req.usuario.id } },
      });
      const usado = agg._sum.tamanho || 0;
      if (usado + req.file.size > LIMITE_STORAGE_FREE) {
        return res.status(403).json({
          error: 'Limite de 500MB de armazenamento atingido no plano gratuito. Faça upgrade para enviar mais documentos.',
          upgrade: true,
        });
      }
    }

    // `arquivo` guarda apenas o nome original (o ícone no front deriva a
    // extensão daqui). Os BYTES vão para documentos_conteudo, no banco.
    const { conteudo, comprimido } = comprimirParaArmazenar(req.file.buffer);

    const documento = await prisma.documento.create({
      data: {
        processoId,
        nome: nome || req.file.originalname,
        arquivo: req.file.originalname,
        tamanho: req.file.size,          // tamanho original (exibido)
        mimeType: req.file.mimetype,
        descricao,
        conteudo: {
          create: { conteudo, comprimido, tamanhoArmazenado: conteudo.length },
        },
      },
    });

    // Avisa os outros participantes de um processo compartilhado que um anexo
    // chegou — assim, ao trocar de tela e voltar, eles veem que algo foi feito.
    notificarParticipantes(processo, req.usuario, `anexou o documento "${documento.nome}"`)
      .catch(() => { /* notificar é secundário */ });

    res.status(201).json(documento);
  } catch (err) { next(err); }
});

// GET /api/documentos/:id/arquivo — Stream autenticado do arquivo
// Autorizado por whereProcessoVisivel: qualquer usuário com acesso ao processo
// (dono OU compartilhado) baixa o arquivo. Os bytes vêm do banco compartilhado,
// então funciona em qualquer máquina — é isso que faz o anexo de um usuário
// ser visível para o outro. Fallback para o disco cobre documentos legados
// (subidos antes desta mudança), se houver.
router.get('/:id/arquivo', async (req, res, next) => {
  try {
    const doc = await prisma.documento.findFirst({
      where: { id: req.params.id, processo: whereProcessoVisivel(req.usuario.id) },
      include: { conteudo: true },
    });
    if (!doc) return res.status(404).json({ error: 'Documento não encontrado.' });

    const mimeType = doc.mimeType || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.nome)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=300');

    // Caminho novo: bytes no banco.
    if (doc.conteudo) {
      const buffer = descomprimir(doc.conteudo);
      res.setHeader('Content-Length', buffer.length);
      return res.end(buffer);
    }

    // Fallback legado: bytes no disco local (documentos anteriores à migração).
    const filePath = caminhoDoDocumento(doc.arquivo);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado.' });
    }
    if (doc.tamanho) res.setHeader('Content-Length', doc.tamanho);
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) res.status(500).json({ error: 'Erro ao ler arquivo.' });
    });
    stream.pipe(res);
  } catch (err) { next(err); }
});

// PUT /api/documentos/:id — Renomear documento
router.put('/:id', async (req, res, next) => {
  try {
    const doc = await prisma.documento.findFirst({
      where: { id: req.params.id, processo: whereProcessoEditavel(req.usuario.id) },
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
      where: { id: req.params.id, processo: whereProcessoEditavel(req.usuario.id) },
    });
    if (!doc) return res.status(404).json({ error: 'Documento não encontrado.' });

    // Os bytes no banco (documentos_conteudo) saem por cascade ao deletar.
    // Ainda limpamos o disco por segurança, para o caso de um documento legado.
    const filePath = caminhoDoDocumento(doc.arquivo);
    if (filePath && fs.existsSync(filePath)) { try { fs.unlinkSync(filePath); } catch { /* ok */ } }

    await prisma.documento.delete({ where: { id: req.params.id } });
    res.json({ mensagem: 'Documento excluído.' });
  } catch (err) { next(err); }
});

// Notifica os OUTROS participantes de um processo compartilhado sobre uma ação
// (anexo, etc.). Silencioso se o processo não é compartilhado.
async function notificarParticipantes(processo, autor, acaoTexto) {
  const compartilhamentos = await prisma.processoCompartilhado.findMany({
    where: { processoId: processo.id },
    select: { usuarioId: true },
  });
  const destinatarios = [processo.usuarioId, ...compartilhamentos.map((c) => c.usuarioId)]
    .filter((id) => id && id !== autor.id);
  if (destinatarios.length === 0) return;

  const ref = processo.numero || processo.numeroCnj || 'processo';
  await Promise.all(destinatarios.map((usuarioId) =>
    notificationService.criarNotificacao({
      usuarioId,
      processoId: processo.id,
      tipo: 'SISTEMA',
      titulo: 'Atualização em processo compartilhado',
      mensagem: `${autor.nome} ${acaoTexto} no processo ${ref}.`,
    })
  ));
}

module.exports = router;
