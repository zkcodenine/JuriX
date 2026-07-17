const { prisma } = require('../config/database');
const { podeVer, ehDono } = require('../utils/acessoProcesso');

const NIVEIS = ['LEITURA', 'EDICAO'];

// GET /api/processos/:id/compartilhamentos
// Quem tem acesso a este processo. Visível para quem já vê o processo.
async function listar(req, res, next) {
  try {
    const acesso = await podeVer(prisma, req.params.id, req.usuario.id);
    if (!acesso.ok) return res.status(acesso.status).json({ error: acesso.erro });

    const compartilhamentos = await prisma.processoCompartilhado.findMany({
      where: { processoId: req.params.id },
      include: { usuario: { select: { id: true, nome: true, email: true, avatar: true } } },
      orderBy: { criadoEm: 'asc' },
    });

    const dono = await prisma.processo.findUnique({
      where: { id: req.params.id },
      select: { usuario: { select: { id: true, nome: true, email: true, avatar: true } } },
    });

    res.json({ dono: dono.usuario, compartilhamentos, souDono: acesso.processo.usuarioId === req.usuario.id });
  } catch (err) { next(err); }
}

// GET /api/processos/:id/compartilhar-com
// Candidatos: colegas da MESMA unidade que ainda não têm acesso.
async function candidatos(req, res, next) {
  try {
    const acesso = await ehDono(prisma, req.params.id, req.usuario.id);
    if (!acesso.ok) return res.status(acesso.status).json({ error: acesso.erro });

    // Sem unidade não há com quem compartilhar — é o vínculo de escritório que
    // define o círculo.
    if (!req.usuario.unidadeId) {
      return res.json({ semUnidade: true, usuarios: [] });
    }

    const jaTem = await prisma.processoCompartilhado.findMany({
      where: { processoId: req.params.id },
      select: { usuarioId: true },
    });

    const usuarios = await prisma.usuario.findMany({
      where: {
        unidadeId: req.usuario.unidadeId,
        ativo: true,
        NOT: { id: { in: [req.usuario.id, ...jaTem.map((c) => c.usuarioId)] } },
      },
      select: { id: true, nome: true, email: true, avatar: true },
      orderBy: { nome: 'asc' },
    });

    res.json({ semUnidade: false, usuarios });
  } catch (err) { next(err); }
}

// POST /api/processos/:id/compartilhar  { usuarioId, nivel }
// Só o dono compartilha. Reenviar para o mesmo usuário troca o nível.
async function compartilhar(req, res, next) {
  try {
    const acesso = await ehDono(prisma, req.params.id, req.usuario.id);
    if (!acesso.ok) return res.status(acesso.status).json({ error: acesso.erro });

    const { usuarioId, nivel = 'LEITURA' } = req.body;
    if (!NIVEIS.includes(nivel)) {
      return res.status(400).json({ error: 'Nível inválido. Use LEITURA ou EDICAO.' });
    }
    if (usuarioId === req.usuario.id) {
      return res.status(400).json({ error: 'Você já é o dono deste processo.' });
    }

    const alvo = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true, nome: true, email: true, avatar: true, unidadeId: true, ativo: true },
    });
    if (!alvo || !alvo.ativo) return res.status(404).json({ error: 'Usuário não encontrado.' });

    // O compartilhamento é dentro do escritório, como combinado.
    if (!req.usuario.unidadeId || alvo.unidadeId !== req.usuario.unidadeId) {
      return res.status(403).json({ error: 'Só é possível compartilhar com usuários da sua unidade.' });
    }

    const compartilhamento = await prisma.processoCompartilhado.upsert({
      where: { processoId_usuarioId: { processoId: req.params.id, usuarioId } },
      create: { processoId: req.params.id, usuarioId, nivel, criadoPor: req.usuario.id },
      update: { nivel },
      include: { usuario: { select: { id: true, nome: true, email: true, avatar: true } } },
    });

    // Avisa quem recebeu.
    await prisma.notificacao
      .create({
        data: {
          usuarioId,
          processoId: req.params.id,
          tipo: 'SISTEMA',
          titulo: 'Processo compartilhado com você',
          mensagem: `${req.usuario.nome} compartilhou um processo com você (${nivel === 'EDICAO' ? 'edição' : 'leitura'}).`,
        },
      })
      .catch(() => { /* notificar é secundário; não derruba o compartilhamento */ });

    res.status(201).json(compartilhamento);
  } catch (err) { next(err); }
}

// DELETE /api/processos/:id/compartilhar/:usuarioId
// O dono revoga de qualquer um; quem recebeu pode sair sozinho.
async function revogar(req, res, next) {
  try {
    const acesso = await podeVer(prisma, req.params.id, req.usuario.id);
    if (!acesso.ok) return res.status(acesso.status).json({ error: acesso.erro });

    const souDono = acesso.processo.usuarioId === req.usuario.id;
    const saindoEuMesmo = req.params.usuarioId === req.usuario.id;
    if (!souDono && !saindoEuMesmo) {
      return res.status(403).json({ error: 'Apenas o dono pode remover o acesso de outra pessoa.' });
    }

    await prisma.processoCompartilhado.deleteMany({
      where: { processoId: req.params.id, usuarioId: req.params.usuarioId },
    });
    res.json({ mensagem: 'Acesso removido.' });
  } catch (err) { next(err); }
}

// ─── Chat de discussão (Fase 3) ────────────────────

// GET /api/processos/:id/mensagens
// Quem vê o processo participa — inclusive quem só tem LEITURA.
async function mensagens(req, res, next) {
  try {
    const acesso = await podeVer(prisma, req.params.id, req.usuario.id);
    if (!acesso.ok) return res.status(acesso.status).json({ error: acesso.erro });

    const { desde } = req.query;
    const lista = await prisma.mensagemProcesso.findMany({
      where: {
        processoId: req.params.id,
        ...(desde ? { criadoEm: { gt: new Date(desde) } } : {}),
      },
      include: { usuario: { select: { id: true, nome: true, avatar: true } } },
      orderBy: { criadoEm: 'asc' },
      take: 500,
    });
    res.json(lista);
  } catch (err) { next(err); }
}

// POST /api/processos/:id/mensagens  { texto }
async function enviarMensagem(req, res, next) {
  try {
    const acesso = await podeVer(prisma, req.params.id, req.usuario.id);
    if (!acesso.ok) return res.status(acesso.status).json({ error: acesso.erro });

    const texto = String(req.body.texto || '').trim();
    if (!texto) return res.status(400).json({ error: 'Mensagem vazia.' });
    if (texto.length > 5000) return res.status(400).json({ error: 'Mensagem muito longa (máx. 5000 caracteres).' });

    const mensagem = await prisma.mensagemProcesso.create({
      data: { processoId: req.params.id, usuarioId: req.usuario.id, texto },
      include: { usuario: { select: { id: true, nome: true, avatar: true } } },
    });

    // Avisa os outros participantes (dono + compartilhados), menos o autor.
    const processo = await prisma.processo.findUnique({
      where: { id: req.params.id },
      select: { usuarioId: true, numero: true, compartilhamentos: { select: { usuarioId: true } } },
    });
    const destinatarios = [processo.usuarioId, ...processo.compartilhamentos.map((c) => c.usuarioId)]
      .filter((id) => id !== req.usuario.id);

    await prisma.notificacao
      .createMany({
        data: destinatarios.map((usuarioId) => ({
          usuarioId,
          processoId: req.params.id,
          tipo: 'SISTEMA',
          titulo: 'Nova mensagem no processo',
          mensagem: `${req.usuario.nome}: ${texto.slice(0, 120)}`,
        })),
      })
      .catch(() => { /* notificar é secundário */ });

    res.status(201).json(mensagem);
  } catch (err) { next(err); }
}

// DELETE /api/processos/:id/mensagens/:mensagemId — o autor remove a própria.
async function removerMensagem(req, res, next) {
  try {
    const acesso = await podeVer(prisma, req.params.id, req.usuario.id);
    if (!acesso.ok) return res.status(acesso.status).json({ error: acesso.erro });

    const msg = await prisma.mensagemProcesso.findFirst({
      where: { id: req.params.mensagemId, processoId: req.params.id },
      select: { id: true, usuarioId: true },
    });
    if (!msg) return res.status(404).json({ error: 'Mensagem não encontrada.' });
    if (msg.usuarioId !== req.usuario.id) {
      return res.status(403).json({ error: 'Você só pode remover suas próprias mensagens.' });
    }

    // Marca como removida em vez de apagar — a conversa não fica com buracos.
    await prisma.mensagemProcesso.update({
      where: { id: msg.id },
      data: { removida: true, texto: '' },
    });
    res.json({ mensagem: 'Mensagem removida.' });
  } catch (err) { next(err); }
}

module.exports = { listar, candidatos, compartilhar, revogar, mensagens, enviarMensagem, removerMensagem };
