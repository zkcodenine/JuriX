const { prisma } = require('../config/database');

// ─── Etiquetas ──────────────────────────────────────

async function listarEtiquetas(req, res, next) {
  try {
    const items = await prisma.etiquetaAgenda.findMany({
      where: { usuarioId: req.usuario.id },
      orderBy: { nome: 'asc' },
    });
    res.json(items);
  } catch (err) { next(err); }
}

async function criarEtiqueta(req, res, next) {
  try {
    const { nome, cor } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório.' });
    const item = await prisma.etiquetaAgenda.create({
      data: { usuarioId: req.usuario.id, nome, cor: cor || '#C9A84C' },
    });
    res.status(201).json(item);
  } catch (err) { next(err); }
}

async function atualizarEtiqueta(req, res, next) {
  try {
    const { nome, cor } = req.body;
    const existe = await prisma.etiquetaAgenda.findFirst({
      where: { id: req.params.id, usuarioId: req.usuario.id },
    });
    if (!existe) return res.status(404).json({ error: 'Etiqueta não encontrada.' });
    const item = await prisma.etiquetaAgenda.update({
      where: { id: req.params.id },
      data: { nome, cor },
    });
    res.json(item);
  } catch (err) { next(err); }
}

async function deletarEtiqueta(req, res, next) {
  try {
    const existe = await prisma.etiquetaAgenda.findFirst({
      where: { id: req.params.id, usuarioId: req.usuario.id },
    });
    if (!existe) return res.status(404).json({ error: 'Etiqueta não encontrada.' });
    await prisma.etiquetaAgenda.delete({ where: { id: req.params.id } });
    res.json({ mensagem: 'Etiqueta removida.' });
  } catch (err) { next(err); }
}

// ─── Eventos ────────────────────────────────────────

async function listarEventos(req, res, next) {
  try {
    const { mes } = req.query; // formato: YYYY-MM
    let where = { usuarioId: req.usuario.id };

    if (mes) {
      const [ano, m] = mes.split('-').map(Number);
      const inicio = new Date(ano, m - 1, 1);
      const fim    = new Date(ano, m, 0, 23, 59, 59);
      where.data = { gte: inicio, lte: fim };
    }

    const items = await prisma.eventoAgenda.findMany({
      where,
      include: { etiqueta: true },
      orderBy: { data: 'asc' },
    });
    res.json(items);
  } catch (err) { next(err); }
}

async function criarEvento(req, res, next) {
  try {
    const { titulo, data, horario, descricao, etiquetaId } = req.body;
    if (!titulo || !data) return res.status(400).json({ error: 'Título e data são obrigatórios.' });

    const item = await prisma.eventoAgenda.create({
      data: {
        usuarioId: req.usuario.id,
        titulo,
        data: data.length === 10 ? new Date(data + 'T12:00:00Z') : new Date(data),
        horario:   horario    || null,
        descricao: descricao  || null,
        etiquetaId: etiquetaId || null,
      },
      include: { etiqueta: true },
    });
    res.status(201).json(item);
  } catch (err) { next(err); }
}

async function atualizarEvento(req, res, next) {
  try {
    const existe = await prisma.eventoAgenda.findFirst({
      where: { id: req.params.id, usuarioId: req.usuario.id },
    });
    if (!existe) return res.status(404).json({ error: 'Evento não encontrado.' });

    const { titulo, data, horario, descricao, etiquetaId } = req.body;
    const item = await prisma.eventoAgenda.update({
      where: { id: req.params.id },
      data: {
        titulo,
        data:       data      ? (data.length === 10 ? new Date(data + 'T12:00:00Z') : new Date(data)) : undefined,
        horario:    horario   !== undefined ? (horario   || null) : undefined,
        descricao:  descricao !== undefined ? (descricao || null) : undefined,
        etiquetaId: etiquetaId !== undefined ? (etiquetaId || null) : undefined,
      },
      include: { etiqueta: true },
    });
    res.json(item);
  } catch (err) { next(err); }
}

async function deletarEvento(req, res, next) {
  try {
    const existe = await prisma.eventoAgenda.findFirst({
      where: { id: req.params.id, usuarioId: req.usuario.id },
    });
    if (!existe) return res.status(404).json({ error: 'Evento não encontrado.' });
    await prisma.eventoAgenda.delete({ where: { id: req.params.id } });
    res.json({ mensagem: 'Evento removido.' });
  } catch (err) { next(err); }
}

module.exports = {
  listarEtiquetas, criarEtiqueta, atualizarEtiqueta, deletarEtiqueta,
  listarEventos, criarEvento, atualizarEvento, deletarEvento,
};
