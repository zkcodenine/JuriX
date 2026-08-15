const router = require('express').Router();
const auth = require('../middlewares/auth');
const { prisma } = require('../config/database');
const { whereProcessoEditavel, whereProcessoVisivel } = require('../utils/acessoProcesso');
const gcal = require('../services/googleCalendarService');

router.use(auth);

// Parcelas agrupadas por situação (recebido no mês / pendente / atrasado),
// com o processo vinculado — alimenta a listagem ao clicar nos cards do painel.
router.get('/por-status', async (req, res, next) => {
  try {
    const parcelas = await prisma.parcela.findMany({
      where: { honorario: { processo: whereProcessoVisivel(req.usuario.id) } },
      include: {
        honorario: { select: { processo: { select: { id: true, numero: true, numeroCnj: true, cobrancaNome: true } } } },
      },
      orderBy: { vencimento: 'asc' },
    });

    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const grupos = { recebido: [], pendente: [], atrasado: [] };

    for (const p of parcelas) {
      const proc = p.honorario.processo;
      const item = {
        parcelaId: p.id,
        processoId: proc.id,
        cliente: proc.cobrancaNome || proc.numero || proc.numeroCnj || 'Cliente',
        numero: proc.numero || proc.numeroCnj || '',
        valor: p.valor,
        vencimento: p.vencimento,
      };
      if (p.status === 'PAGO') {
        if (p.dataPagamento && new Date(p.dataPagamento) >= inicioMes) grupos.recebido.push(item);
      } else if (new Date(p.vencimento) < agora) {
        grupos.atrasado.push(item);
      } else {
        grupos.pendente.push(item);
      }
    }

    res.json(grupos);
  } catch (err) { next(err); }
});

const fmtBRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
    // Opt-in de Google Agenda (padrão ON) e notificação de vencimento.
    const googleSync = req.body.googleSync !== false;
    const notificarVencimento = req.body.notificarVencimento !== false;
    const notificarDiasAntes = Number.isFinite(Number(req.body.notificarDiasAntes))
      ? Math.max(0, Math.min(60, Number(req.body.notificarDiasAntes))) : 3;

    if (!processoId || !valorTotal) {
      return res.status(400).json({ error: 'processoId e valorTotal são obrigatórios.' });
    }

    // Verifica se o processo pertence ao usuário
    const processo = await prisma.processo.findFirst({
      where: { id: processoId, ...whereProcessoEditavel(req.usuario.id) },
      select: { id: true, numero: true, cobrancaNome: true },
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
        googleSync, notificarVencimento, notificarDiasAntes,
        parcelas: parcelasFormatadas.length ? { create: parcelasFormatadas } : undefined,
      },
      include: { parcelas: true },
    });

    // Espelha cada vencimento na Google Agenda (best-effort), se ativado.
    if (googleSync) {
      const cliente = processo.cobrancaNome || processo.numero || 'cliente';
      for (const parcela of honorario.parcelas) {
        const googleEventId = await gcal.sincronizarParcela(req.usuario.id, parcela, {
          cliente, valor: fmtBRL(parcela.valor), diasAntes: notificarVencimento ? notificarDiasAntes : 0,
        });
        if (googleEventId) {
          await prisma.parcela.update({ where: { id: parcela.id }, data: { googleEventId } });
        }
      }
    }

    res.status(201).json(honorario);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    // Verifica se o honorário pertence a um processo do usuário
    const existe = await prisma.honorario.findFirst({
      where: { id: req.params.id, processo: whereProcessoEditavel(req.usuario.id) },
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
      where: { id: req.params.id, processo: whereProcessoEditavel(req.usuario.id) },
    });
    if (!existe) return res.status(404).json({ error: 'Honorário não encontrado.' });

    // Remove os eventos das parcelas na Google Agenda (não deixa lixo).
    const parcelas = await prisma.parcela.findMany({
      where: { honorarioId: req.params.id, googleEventId: { not: null } },
      select: { googleEventId: true },
    });
    for (const p of parcelas) {
      await gcal.deletarEventoGoogle(req.usuario.id, p.googleEventId);
    }

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
      where: { id: req.params.parcelaId, honorario: { id: req.params.id, processo: whereProcessoEditavel(req.usuario.id) } },
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
      where: { id: req.params.id, processo: whereProcessoEditavel(req.usuario.id) },
    });
    if (!existe) return res.status(404).json({ error: 'Honorário não encontrado.' });

    const parcela = await prisma.parcela.create({ data: { ...req.body, honorarioId: req.params.id } });
    res.status(201).json(parcela);
  } catch (err) { next(err); }
});

module.exports = router;
