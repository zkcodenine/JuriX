// ══════════════════════════════════════════════════════
//  JuriX — Process Monitor Service
//  Monitora processos vinculados a cada 30 minutos
//  usando o TribunalRegistry para fontes múltiplas.
//  Detecta novas movimentações automaticamente e
//  destaca processos com atualizações no dashboard.
// ══════════════════════════════════════════════════════
const { prisma } = require('../config/database');
const tribunalRegistry = require('./tribunalRegistry');
const datajudService = require('./datajudService');
const notificationService = require('./notificationService');
const logger = require('../config/logger');

// ─── Executar monitoramento geral ──────────────────
async function executarMonitoramento() {
  logger.info('🔍 Process Monitor: iniciando ciclo de verificação...');

  try {
    // Busca todos os processos com monitoramento ativo e vinculados ao CNJ
    const processos = await prisma.processo.findMany({
      where: {
        monitoramentoAtivo: true,
        numeroCnj: { not: null },
        tribunal: { not: null },
      },
      select: {
        id: true,
        numeroCnj: true,
        tribunal: true,
        usuarioId: true,
        numero: true,
        origemDados: true,
        movimentacoes: {
          orderBy: { data: 'desc' },
          take: 1,
          select: { data: true },
        },
      },
    });

    logger.info(`📋 Process Monitor: ${processos.length} processos para verificar`);

    // Agrupa por tribunal para log
    const porTribunal = {};
    for (const p of processos) {
      const t = p.tribunal?.toUpperCase() || 'OUTRO';
      porTribunal[t] = (porTribunal[t] || 0) + 1;
    }
    logger.info(`📊 Process Monitor por tribunal: ${JSON.stringify(porTribunal)}`);

    let totalNovas = 0;
    const erros = [];

    for (const processo of processos) {
      try {
        const novas = await verificarProcesso(processo);
        totalNovas += novas;
      } catch (err) {
        erros.push({ processoId: processo.id, erro: err.message });
        logger.error(`Process Monitor erro no processo ${processo.id}:`, err.message);
      }

      // Delay entre requisições para evitar rate limiting
      await sleep(500);
    }

    logger.info(`✅ Process Monitor: ciclo concluído. Processos: ${processos.length}, Novas movimentações: ${totalNovas}, Erros: ${erros.length}`);
    return { verificados: processos.length, novasMovimentacoes: totalNovas, erros };

  } catch (err) {
    logger.error('Process Monitor erro geral:', err);
    throw err;
  }
}

// ─── Verificar um processo específico ─────────────
async function verificarProcesso(processo) {
  const ultimaMovimentacao = processo.movimentacoes?.[0];
  const ultimaData = ultimaMovimentacao?.data || null;
  const tribunal = processo.tribunal?.toUpperCase() || '';

  // Conta movimentações existentes para decidir se faz sync completo
  const movCount = await prisma.movimentacao.count({ where: { processoId: processo.id } });

  // Se processo tem poucas movimentações, faz sync completo (sem filtro de data)
  // Isso garante que movimentações antigas que não foram capturadas sejam adicionadas
  const fazerSyncCompleto = movCount < 3;

  // Usa TribunalRegistry para obter movimentações da melhor fonte
  const temProviderEspecifico = tribunalRegistry.temProviderEspecifico(tribunal);
  let novas;

  if (temProviderEspecifico) {
    logger.info(`Process Monitor: usando provider específico para ${tribunal} (${processo.numeroCnj})${fazerSyncCompleto ? ' [SYNC COMPLETO]' : ''}`);
    novas = await tribunalRegistry.verificarMovimentacoes(
      processo.numeroCnj,
      tribunal,
      fazerSyncCompleto ? null : ultimaData
    );
  } else {
    // Fallback direto para DataJud
    novas = await datajudService.verificarMovimentacoes(
      processo.numeroCnj,
      tribunal,
      fazerSyncCompleto ? null : ultimaData
    );
  }

  // Verifica se o processo tem partes — se não, tenta buscar
  const partesCount = await prisma.parte.count({ where: { processoId: processo.id } });
  if (partesCount === 0) {
    try {
      const dadosCompletos = temProviderEspecifico
        ? await tribunalRegistry.consultarProcesso(processo.numeroCnj, tribunal)
        : await datajudService.consultarProcesso(processo.numeroCnj, tribunal);

      if (dadosCompletos?.partes?.length) {
        for (const p of dadosCompletos.partes) {
          await prisma.parte.create({
            data: { processoId: processo.id, nome: p.nome, tipo: p.tipo },
          }).catch(() => {}); // ignora duplicatas
        }
        logger.info(`📝 Process Monitor: ${dadosCompletos.partes.length} parte(s) adicionadas ao processo ${processo.numeroCnj}`);
      }
      // Também adiciona advogados se ausentes
      const advCount = await prisma.advogadoProcesso.count({ where: { processoId: processo.id } });
      if (advCount === 0 && dadosCompletos?.advogados?.length) {
        for (const a of dadosCompletos.advogados) {
          await prisma.advogadoProcesso.create({
            data: { processoId: processo.id, nome: a.nome, oab: a.numeroDocumentoPrincipal },
          }).catch(() => {});
        }
      }
    } catch (err) {
      logger.warn(`Process Monitor: falha ao buscar partes para ${processo.numeroCnj}: ${err.message}`);
    }
  }

  if (!novas || novas.length === 0) {
    logger.debug(`Process Monitor: sem novidades em ${processo.numeroCnj}`);
    return 0;
  }

  logger.info(`🔔 Process Monitor: ${novas.length} nova(s) movimentação(ões) em ${processo.numeroCnj}`);

  // Salva movimentações novas (evita duplicatas via hashExterno)
  let salvas = 0;
  for (const mov of novas) {
    try {
      await prisma.movimentacao.upsert({
        where: { hashExterno: mov.hashExterno },
        update: {},
        create: {
          processoId: processo.id,
          data: mov.data,
          descricao: mov.descricao,
          tipo: mov.tipo,
          origemApi: mov.origemApi || 'datajud',
          hashExterno: mov.hashExterno,
        },
      });
      salvas++;
    } catch (_) {
      // Ignore duplicatas silenciosamente
    }
  }

  if (salvas === 0) {
    logger.debug(`Process Monitor: movimentações já registradas em ${processo.numeroCnj}`);
    return 0;
  }

  // Atualiza data da última atualização do processo
  await prisma.processo.update({
    where: { id: processo.id },
    data: { dataUltimaAtualizacao: new Date() },
  });

  // Gera notificação para o usuário com contagem
  const descricaoPrincipal = novas[0].descricao;
  const fonte = novas[0].origemApi === 'tjmg' ? ' (TJMG)' : novas[0].origemApi === 'datajud' ? ' (DataJud)' : '';
  await notificationService.criarNotificacao({
    usuarioId: processo.usuarioId,
    processoId: processo.id,
    titulo: `${salvas} nova${salvas > 1 ? 's' : ''} movimentação${salvas > 1 ? 'ões' : ''}${fonte}`,
    mensagem: salvas > 1
      ? `${salvas} novas movimentações detectadas no processo ${processo.numero || processo.numeroCnj}. Mais recente: ${descricaoPrincipal}`
      : `Nova movimentação no processo ${processo.numero || processo.numeroCnj}: ${descricaoPrincipal}`,
    tipo: 'MOVIMENTACAO',
  });

  // Sugerir criação de tarefa automaticamente
  await sugerirTarefa(processo, novas[0]);

  return salvas;
}

// ─── Verificar prazos próximos ─────────────────────
async function verificarPrazos() {
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);

  const em3Dias = new Date();
  em3Dias.setDate(em3Dias.getDate() + 3);

  const em7Dias = new Date();
  em7Dias.setDate(em7Dias.getDate() + 7);

  const prazos = await prisma.prazo.findMany({
    where: {
      status: 'PENDENTE',
      dataVencimento: {
        gte: new Date(),
        lte: em7Dias,
      },
    },
    include: {
      processo: { select: { usuarioId: true, numero: true } },
    },
  });

  for (const prazo of prazos) {
    const diasRestantes = Math.ceil(
      (prazo.dataVencimento - new Date()) / (1000 * 60 * 60 * 24)
    );

    let mensagem;
    if (diasRestantes <= 1) {
      mensagem = `⚠️ URGENTE: Prazo "${prazo.titulo}" vence AMANHÃ no processo ${prazo.processo.numero}`;
    } else {
      mensagem = `⏰ Prazo "${prazo.titulo}" vence em ${diasRestantes} dias — Processo ${prazo.processo.numero}`;
    }

    await notificationService.criarNotificacao({
      usuarioId: prazo.processo.usuarioId,
      processoId: prazo.processoId,
      titulo: diasRestantes <= 1 ? 'Prazo urgente!' : 'Prazo próximo',
      mensagem,
      tipo: 'PRAZO',
    });
  }

  logger.info(`⏰ Process Monitor: ${prazos.length} alertas de prazo gerados`);
}

// ─── Sugerir tarefa após nova movimentação ─────────
async function sugerirTarefa(processo, movimentacao) {
  const descricaoLower = movimentacao.descricao.toLowerCase();
  let titulo = null;

  if (descricaoLower.includes('despacho') || descricaoLower.includes('decisão')) {
    titulo = `Analisar despacho/decisão — Processo ${processo.numero || processo.numeroCnj}`;
  } else if (descricaoLower.includes('sentença')) {
    titulo = `Analisar sentença e verificar recurso — Processo ${processo.numero || processo.numeroCnj}`;
  } else if (descricaoLower.includes('audiência') || descricaoLower.includes('audiencia')) {
    titulo = `Preparar para audiência — Processo ${processo.numero || processo.numeroCnj}`;
  } else if (descricaoLower.includes('prazo')) {
    titulo = `Verificar prazo detectado — Processo ${processo.numero || processo.numeroCnj}`;
  }

  if (titulo) {
    await prisma.tarefa.create({
      data: {
        processoId: processo.id,
        usuarioId: processo.usuarioId,
        titulo,
        descricao: `Sugerido automaticamente após detecção: "${movimentacao.descricao}"`,
        prioridade: 'ALTA',
        status: 'PENDENTE',
      },
    });
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { executarMonitoramento, verificarProcesso, verificarPrazos };
