const router = require('express').Router();
const auth = require('../middlewares/auth');
const { prisma } = require('../config/database');

router.use(auth);

function parseDateSafe(value) {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(str + 'T12:00:00.000Z');
  }
  const d = new Date(str);
  if (isNaN(d.getTime())) {
    throw new Error('Data de vencimento inválida: ' + value);
  }
  return d;
}

router.post('/', async (req, res, next) => {
  try {
    const { parcelas, valorTotal, processoId, descricao } = req.body;

    if (!processoId || !valorTotal) {
      return res.status(400).json({ error: 'processoId e valorTotal são obrigatórios.' });
    }

    // Verifica se o processo pertence ao usuário
    const processo = await prisma.processo.findFirst({
      where: { id: processoId, usuarioId: req.usuario.id },
    });
    if (!processo) return res.status(404).json({ error: 'Processo não encontrado.' });

    // Garante que vencimento seja DateTime válido para o Prisma
    const parcelasFormatadas = (parcelas || []).map(p => ({
      valor: parseFloat(p.valor),
      vencimento: parseDateSafe(p.vencimento),
      status: 'PENDENTE',
    }));

    const honorario = await prisma.honorario.create({
      data: {
        processoId,
        valorTotal: parseFloat(valorTotal),
        descricao: descricao || null,
        parcelas: parcelasFormatadas.length ? { create: parcelasFormatadas } : undefined,
      },
      include: { parcelas: true },
    });
    res.status(201).json(honorario);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    // Verifica se o honorário pertence a um processo do usuário
    const existe = await prisma.honorario.findFirst({
      where: { id: req.params.id, processo: { usuarioId: req.usuario.id } },
    });
    if (!existe) return res.status(404).json({ error: 'Honorário não encontrado.' });

    const hon = await prisma.honorario.update({ where: { id: req.params.id }, data: req.body });
    res.json(hon);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    // Verifica se o honorário pertence a um processo do usuário
    const existe = await prisma.honorario.findFirst({
      where: { id: req.params.id, processo: { usuarioId: req.usuario.id } },
    });
    if (!existe) return res.status(404).json({ error: 'Honorário não encontrado.' });

    await prisma.parcela.deleteMany({ where: { honorarioId: req.params.id } });
    await prisma.honorario.delete({ where: { id: req.params.id } });
    res.json({ mensagem: 'Honorário excluído.' });
  } catch (err) { next(err); }
});

// Parcelas
router.put('/:id/parcelas/:parcelaId', async (req, res, next) => {
  try {
    // Verifica se a parcela pertence a um honorário de um processo do usuário
    const existe = await prisma.parcela.findFirst({
      where: { id: req.params.parcelaId, honorario: { id: req.params.id, processo: { usuarioId: req.usuario.id } } },
    });
    if (!existe) return res.status(404).json({ error: 'Parcela não encontrada.' });

    const parcela = await prisma.parcela.update({ where: { id: req.params.parcelaId }, data: req.body });
    res.json(parcela);
  } catch (err) { next(err); }
});

router.post('/:id/parcelas', async (req, res, next) => {
  try {
    // Verifica se o honorário pertence a um processo do usuário
    const existe = await prisma.honorario.findFirst({
      where: { id: req.params.id, processo: { usuarioId: req.usuario.id } },
    });
    if (!existe) return res.status(404).json({ error: 'Honorário não encontrado.' });

    const parcela = await prisma.parcela.create({ data: { ...req.body, honorarioId: req.params.id } });
    res.status(201).json(parcela);
  } catch (err) { next(err); }
});

module.exports = router;
