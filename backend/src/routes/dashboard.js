const router = require('express').Router();
const auth = require('../middlewares/auth');
const { prisma } = require('../config/database');

router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const uid = req.usuario.id;
    const hoje = new Date();
    const em7Dias = new Date(hoje); em7Dias.setDate(hoje.getDate() + 7);
    const em14Dias = new Date(hoje); em14Dias.setDate(hoje.getDate() + 14);
    const ultimas48h = new Date(hoje); ultimas48h.setHours(ultimas48h.getHours() - 48);

    // Week boundaries (Sunday to Saturday)
    const todayDow = hoje.getDay();
    const weekStart = new Date(hoje); weekStart.setDate(hoje.getDate() - todayDow); weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6); weekEnd.setHours(23, 59, 59, 999);

    // Month boundaries
    const mesInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const mesFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999);

    // Today boundaries
    const hojeInicio = new Date(hoje); hojeInicio.setHours(0, 0, 0, 0);
    const hojeFim = new Date(hoje); hojeFim.setHours(23, 59, 59, 999);

    const [
      totalAtivos, totalFinalizados, totalSuspensos, totalAguardando,
      tarefasPendentes, tarefasUrgentes,
      prazosProximos, prazosVencendo,
      notificacoesNaoLidas,
      ultimosPrazos,
      honorariosPendentes,
      processosAtualizados,
      notificacoesRecentes,
      movimentacoesPorOrigem,
      // New queries for enhanced dashboard
      eventosHoje,
      eventosSemana,
      parcelasRecebidas,
      parcelasPendentes,
      parcelasAtrasadas,
      processosLista,
      prazosHoje,
    ] = await Promise.all([
      prisma.processo.count({ where: { usuarioId: uid, status: 'ATIVO' } }),
      prisma.processo.count({ where: { usuarioId: uid, status: 'ENCERRADO' } }),
      prisma.processo.count({ where: { usuarioId: uid, status: 'SUSPENSO' } }),
      prisma.processo.count({ where: { usuarioId: uid, status: 'AGUARDANDO' } }),
      prisma.tarefa.count({ where: { usuarioId: uid, status: 'PENDENTE' } }),
      prisma.tarefa.count({ where: { usuarioId: uid, status: 'PENDENTE', prioridade: 'URGENTE' } }),
      prisma.prazo.count({
        where: { processo: { usuarioId: uid }, status: 'PENDENTE', dataVencimento: { gte: hoje, lte: em7Dias } },
      }),
      prisma.prazo.count({
        where: { processo: { usuarioId: uid }, status: 'PENDENTE', dataVencimento: { lt: hoje } },
      }),
      prisma.notificacao.count({ where: { usuarioId: uid, lida: false } }),
      prisma.prazo.findMany({
        where: { processo: { usuarioId: uid }, status: 'PENDENTE', dataVencimento: { gte: hoje } },
        orderBy: { dataVencimento: 'asc' },
        take: 8,
        include: { processo: { select: { id: true, numero: true, numeroCnj: true } } },
      }),
      prisma.parcela.aggregate({
        where: { honorario: { processo: { usuarioId: uid } }, status: 'PENDENTE' },
        _sum: { valor: true },
      }),
      prisma.processo.findMany({
        where: {
          usuarioId: uid,
          movimentacoes: { some: { criadoEm: { gte: ultimas48h } } },
        },
        orderBy: { dataUltimaAtualizacao: 'desc' },
        take: 12,
        select: {
          id: true, numero: true, numeroCnj: true, tribunal: true, status: true,
          dataUltimaAtualizacao: true, origemDados: true,
          _count: { select: { movimentacoes: true } },
          partes: { take: 1, select: { nome: true } },
          movimentacoes: {
            orderBy: { criadoEm: 'desc' }, take: 3,
            select: { id: true, descricao: true, data: true, tipo: true, origemApi: true, criadoEm: true },
          },
        },
      }),
      prisma.notificacao.findMany({
        where: { usuarioId: uid, lida: false },
        orderBy: { criadoEm: 'desc' }, take: 5,
        select: { id: true, titulo: true, mensagem: true, tipo: true, criadoEm: true, processoId: true },
      }),
      prisma.movimentacao.groupBy({
        by: ['origemApi'],
        where: { processo: { usuarioId: uid } },
        _count: true,
      }),

      // ── Eventos de hoje (audiências / compromissos) ──────
      prisma.eventoAgenda.findMany({
        where: {
          usuarioId: uid,
          data: { gte: hojeInicio, lte: hojeFim },
        },
        orderBy: { horario: 'asc' },
        include: { etiqueta: { select: { nome: true, cor: true } } },
      }),

      // ── Eventos da semana ────────────────────────────────
      prisma.eventoAgenda.findMany({
        where: {
          usuarioId: uid,
          data: { gte: weekStart, lte: weekEnd },
        },
        orderBy: [{ data: 'asc' }, { horario: 'asc' }],
        include: { etiqueta: { select: { nome: true, cor: true } } },
      }),

      // ── Honorários: recebidos no mês ─────────────────────
      prisma.parcela.aggregate({
        where: {
          honorario: { processo: { usuarioId: uid } },
          status: 'PAGO',
          dataPagamento: { gte: mesInicio, lte: mesFim },
        },
        _sum: { valor: true },
      }),

      // ── Honorários: pendentes (todas) ────────────────────
      prisma.parcela.aggregate({
        where: {
          honorario: { processo: { usuarioId: uid } },
          status: 'PENDENTE',
          vencimento: { gte: hoje },
        },
        _sum: { valor: true },
      }),

      // ── Honorários: atrasados ────────────────────────────
      prisma.parcela.aggregate({
        where: {
          honorario: { processo: { usuarioId: uid } },
          status: { in: ['PENDENTE', 'ATRASADO'] },
          vencimento: { lt: hoje },
        },
        _sum: { valor: true },
      }),

      // ── Processos lista rápida (até 8) ───────────────────
      prisma.processo.findMany({
        where: { usuarioId: uid, status: 'ATIVO' },
        orderBy: { atualizadoEm: 'desc' },
        take: 8,
        select: {
          id: true, numero: true, numeroCnj: true, tribunal: true, status: true, vara: true,
          partes: { take: 1, select: { nome: true } },
          _count: { select: { movimentacoes: true, tarefas: true } },
        },
      }),

      // ── Prazos de hoje ───────────────────────────────────
      prisma.prazo.findMany({
        where: {
          processo: { usuarioId: uid },
          status: 'PENDENTE',
          dataVencimento: { gte: hojeInicio, lte: hojeFim },
        },
        include: { processo: { select: { id: true, numero: true, numeroCnj: true } } },
      }),
    ]);

    // ── Honorários: parcelas recentes para listagem ────────
    const parcelasListagem = await prisma.parcela.findMany({
      where: {
        honorario: { processo: { usuarioId: uid } },
      },
      orderBy: { vencimento: 'asc' },
      take: 5,
      include: {
        honorario: {
          include: {
            processo: { select: { id: true, numero: true, numeroCnj: true, partes: { take: 1, select: { nome: true } } } },
          },
        },
      },
    });

    // Distribuição de status dos processos
    const statusDistribuicao = {
      ATIVO: totalAtivos,
      ENCERRADO: totalFinalizados,
      SUSPENSO: totalSuspensos,
      AGUARDANDO: totalAguardando,
    };

    // Origem das movimentações
    const origemMovimentacoes = {};
    movimentacoesPorOrigem.forEach(item => {
      origemMovimentacoes[item.origemApi || 'manual'] = item._count;
    });

    // Honorários summary
    const recebidoMes = Number(parcelasRecebidas._sum?.valor || 0);
    const pendente = Number(parcelasPendentes._sum?.valor || 0);
    const atrasado = Number(parcelasAtrasadas._sum?.valor || 0);

    res.json({
      indicadores: {
        processosAtivos: totalAtivos,
        processosFinalizados: totalFinalizados,
        processosSuspensos: totalSuspensos,
        tarefasPendentes,
        tarefasUrgentes,
        prazosProximos,
        prazosVencidos: prazosVencendo,
        notificacoesNaoLidas,
        honorariosPendentes: Number(honorariosPendentes._sum?.valor || 0),
        processosComAtualizacao: processosAtualizados.length,
        audienciasHoje: eventosHoje.length,
        prazosHoje: prazosHoje.length,
      },
      ultimosPrazos,
      processosAtualizados,
      notificacoesRecentes,
      graficos: {
        statusDistribuicao,
        origemMovimentacoes,
      },
      // ── New dashboard data ──────────────────────────────
      audienciasHoje: eventosHoje.map(e => ({
        id: e.id,
        titulo: e.titulo,
        horario: e.horario,
        descricao: e.descricao,
        data: e.data,
        etiqueta: e.etiqueta,
      })),
      eventosSemana: eventosSemana.map(e => ({
        id: e.id,
        titulo: e.titulo,
        horario: e.horario,
        data: e.data,
        descricao: e.descricao,
        etiqueta: e.etiqueta,
      })),
      honorariosMes: {
        recebido: recebidoMes,
        pendente,
        atrasado,
        previsto: recebidoMes + pendente,
        parcelas: parcelasListagem.map(p => ({
          id: p.id,
          valor: Number(p.valor),
          vencimento: p.vencimento,
          status: p.status,
          dataPagamento: p.dataPagamento,
          processoNumero: p.honorario?.processo?.numero || p.honorario?.processo?.numeroCnj || 'Sem processo',
          processoNome: p.honorario?.processo?.partes?.[0]?.nome || p.honorario?.processo?.numero || p.honorario?.processo?.numeroCnj || 'Sem processo',
          processoId: p.honorario?.processo?.id,
          descricao: p.honorario?.descricao,
        })),
      },
      processosLista: processosLista.map(p => ({
        id: p.id,
        numero: p.numero,
        numeroCnj: p.numeroCnj,
        tribunal: p.tribunal,
        vara: p.vara,
        status: p.status,
        nomeCliente: p.partes?.[0]?.nome || null,
        movimentacoes: p._count.movimentacoes,
        tarefas: p._count.tarefas,
      })),
      prazosHoje,
      weekStart: weekStart.toISOString(),
    });
  } catch (err) { next(err); }
});

module.exports = router;
