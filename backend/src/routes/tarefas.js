const router = require('express').Router();
const auth = require('../middlewares/auth');
const { prisma } = require('../config/database');

router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const { status, prioridade, processoId } = req.query;
    const where = { usuarioId: req.usuario.id };
    if (status) where.status = status;
    if (prioridade) where.prioridade = prioridade;
    if (processoId) where.processoId = processoId;

    const tarefas = await prisma.tarefa.findMany({
      where,
      include: { subtarefas: true, processo: { select: { id: true, numero: true, numeroCnj: true, partes: { take: 1, where: { tipo: 'AUTOR' }, select: { nome: true } } } } },
      orderBy: [{ prioridade: 'desc' }, { prazo: 'asc' }],
    });
    res.json(tarefas);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { subtarefas, ...body } = req.body;

    // Whitelist explícita — evita campos desconhecidos que causariam PrismaClientValidationError
    const dados = {
      titulo:     body.titulo,
      descricao:  body.descricao  || null,
      prazo:      body.prazo ? new Date(body.prazo.includes('T') ? body.prazo : body.prazo + 'T12:00:00.000Z') : null,
      prioridade: body.prioridade || 'MEDIA',
      status:     body.status     || 'PENDENTE',
      processoId: body.processoId || null,
    };

    const tarefa = await prisma.tarefa.create({
      data: {
        ...dados,
        usuarioId: req.usuario.id,
        subtarefas: subtarefas?.length ? { create: subtarefas } : undefined,
      },
      include: { subtarefas: true },
    });
    res.status(201).json(tarefa);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.prazo) {
      data.prazo = new Date(data.prazo.includes('T') ? data.prazo : data.prazo + 'T12:00:00.000Z');
    }
    const tarefa = await prisma.tarefa.updateMany({
      where: { id: req.params.id, usuarioId: req.usuario.id },
      data,
    });
    res.json(tarefa);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.tarefa.deleteMany({ where: { id: req.params.id, usuarioId: req.usuario.id } });
    res.json({ mensagem: 'Tarefa excluída.' });
  } catch (err) { next(err); }
});

// Subtarefas — verifica que a tarefa-pai pertence ao usuário
router.post('/:id/subtarefas', async (req, res, next) => {
  try {
    const tarefa = await prisma.tarefa.findFirst({ where: { id: req.params.id, usuarioId: req.usuario.id } });
    if (!tarefa) return res.status(404).json({ error: 'Tarefa não encontrada.' });

    const sub = await prisma.subtarefa.create({ data: { ...req.body, tarefaId: req.params.id } });
    res.status(201).json(sub);
  } catch (err) { next(err); }
});

router.put('/:id/subtarefas/:subId', async (req, res, next) => {
  try {
    const existe = await prisma.subtarefa.findFirst({
      where: { id: req.params.subId, tarefa: { id: req.params.id, usuarioId: req.usuario.id } },
    });
    if (!existe) return res.status(404).json({ error: 'Subtarefa não encontrada.' });

    const sub = await prisma.subtarefa.update({ where: { id: req.params.subId }, data: req.body });
    res.json(sub);
  } catch (err) { next(err); }
});

router.delete('/:id/subtarefas/:subId', async (req, res, next) => {
  try {
    const existe = await prisma.subtarefa.findFirst({
      where: { id: req.params.subId, tarefa: { id: req.params.id, usuarioId: req.usuario.id } },
    });
    if (!existe) return res.status(404).json({ error: 'Subtarefa não encontrada.' });

    await prisma.subtarefa.delete({ where: { id: req.params.subId } });
    res.json({ mensagem: 'Subtarefa excluída.' });
  } catch (err) { next(err); }
});

module.exports = router;
