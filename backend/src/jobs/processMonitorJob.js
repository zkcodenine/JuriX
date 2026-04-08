// ══════════════════════════════════════════════════════
//  JuriX — Process Monitor Job
//  Agenda execução a cada 30 minutos via node-cron.
//  Usa TribunalRegistry para integração com múltiplos
//  tribunais (TJMG, DataJud, futuros).
// ══════════════════════════════════════════════════════
const cron = require('node-cron');
const { executarMonitoramento, verificarPrazos } = require('../services/processMonitorService');
const tribunalRegistry = require('../services/tribunalRegistry');
const logger = require('../config/logger');

const INTERVALO_MINUTOS = parseInt(process.env.MONITOR_INTERVAL_MINUTES || '30', 10);

function buildCronExpression(minutos) {
  if (minutos >= 60) {
    const horas = Math.floor(minutos / 60);
    return `0 */${horas} * * *`; // a cada N horas
  }
  return `*/${minutos} * * * *`; // a cada N minutos
}

function startProcessMonitor() {
  const cronExpr = buildCronExpression(INTERVALO_MINUTOS);

  // Log providers disponíveis
  const providers = tribunalRegistry.listarProvidersEspecificos();
  const providerList = providers.length > 0
    ? providers.map(p => p.codigo).join(', ')
    : 'nenhum (usando DataJud para todos)';
  logger.info(`⏰ Process Monitor agendado: "${cronExpr}" (a cada ${INTERVALO_MINUTOS} min)`);
  logger.info(`📡 Providers específicos: ${providerList}`);

  // ─── Execução inicial ao iniciar o servidor ────────
  setTimeout(async () => {
    logger.info('🔄 Process Monitor Job: execução inicial ao iniciar...');
    try {
      const resultado = await executarMonitoramento();
      if (resultado.novasMovimentacoes > 0) {
        logger.info(`🆕 Sync inicial: ${resultado.novasMovimentacoes} nova(s) movimentação(ões) detectada(s)!`);
      } else {
        logger.info('✅ Sync inicial concluído — nenhuma novidade.');
      }
    } catch (err) {
      logger.error('Sync inicial falhou:', err.message);
    }
  }, 5000); // Aguarda 5s para garantir que tudo inicializou

  // ─── Monitoramento de processos (a cada 30 min) ────
  cron.schedule(cronExpr, async () => {
    logger.info('🔄 Process Monitor Job: executando...');
    try {
      const resultado = await executarMonitoramento();
      if (resultado.novasMovimentacoes > 0) {
        logger.info(`🆕 Process Monitor Job: ${resultado.novasMovimentacoes} nova(s) movimentação(ões) detectada(s)!`);
      }
    } catch (err) {
      logger.error('Process Monitor Job falhou:', err.message);
    }
  });

  // ─── Verificação de prazos diária (08:00) ──────────
  cron.schedule('0 8 * * *', async () => {
    logger.info('⏰ Prazo Monitor Job: verificando prazos próximos...');
    try {
      await verificarPrazos();
    } catch (err) {
      logger.error('Prazo Monitor Job falhou:', err.message);
    }
  });

  // ─── Segunda verificação de prazos às 18:00 ────────
  cron.schedule('0 18 * * *', async () => {
    try {
      await verificarPrazos();
    } catch (err) {
      logger.error('Prazo Monitor Job (tarde) falhou:', err.message);
    }
  });

  logger.info('✅ Todos os jobs agendados com sucesso');
}

module.exports = { startProcessMonitor };
