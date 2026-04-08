const { prisma } = require('../config/database');
const logger = require('../config/logger');

// ─── Criar notificação ─────────────────────────────
async function criarNotificacao({ usuarioId, processoId, titulo, mensagem, tipo = 'INFO' }) {
  try {
    const notificacao = await prisma.notificacao.create({
      data: { usuarioId, processoId: processoId || null, titulo, mensagem, tipo },
    });
    logger.debug(`Notificação criada: ${titulo} para usuário ${usuarioId}`);
    return notificacao;
  } catch (err) {
    logger.error('Erro ao criar notificação:', err.message);
  }
}

// ─── Listar notificações do usuário ────────────────
async function listarNotificacoes(usuarioId, { pagina = 1, limite = 30, apenasNaoLidas = false } = {}) {
  const where = { usuarioId };
  if (apenasNaoLidas) where.lida = false;

  const [notificacoes, total, naoLidas] = await Promise.all([
    prisma.notificacao.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      skip: (Number(pagina) - 1) * Number(limite),
      take: Number(limite),
      include: {
        processo: { select: { numero: true, numeroCnj: true } },
      },
    }),
    prisma.notificacao.count({ where }),
    prisma.notificacao.count({ where: { usuarioId, lida: false } }),
  ]);

  return { notificacoes, total, naoLidas };
}

// ─── Marcar como lida ──────────────────────────────
async function marcarComoLida(id, usuarioId) {
  return prisma.notificacao.updateMany({
    where: { id, usuarioId },
    data: { lida: true },
  });
}

// ─── Marcar como lida por processo ─────────────────
async function marcarComoLidaPorProcesso(processoId, usuarioId) {
  return prisma.notificacao.updateMany({
    where: { processoId, usuarioId, lida: false },
    data: { lida: true },
  });
}

// ─── Marcar todas como lidas ───────────────────────
async function marcarTodasComoLidas(usuarioId) {
  return prisma.notificacao.updateMany({
    where: { usuarioId, lida: false },
    data: { lida: true },
  });
}

module.exports = { criarNotificacao, listarNotificacoes, marcarComoLida, marcarComoLidaPorProcesso, marcarTodasComoLidas };
