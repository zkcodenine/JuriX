// Suporta DOTENV_CONFIG_PATH definido pelo Electron (app empacotado)
require('dotenv').config(
  process.env.DOTENV_CONFIG_PATH
    ? { path: process.env.DOTENV_CONFIG_PATH, override: true }
    : {}
);
const app = require('./app');
const { connectDatabase } = require('./config/database');
const { connectRedis } = require('./config/redis');
const { startProcessMonitor } = require('./jobs/processMonitorJob');
const logger = require('./config/logger');

const PORT = process.env.PORT || 3001;

// ─── Libera porta ocupada por processo anterior (Windows) ────────────────────
async function freePortIfBusy(port) {
  if (process.platform !== 'win32') return;
  const { execSync } = require('child_process');
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', windowsHide: true });
    const pids = new Set();
    for (const line of out.split('\n')) {
      const m = line.trim().match(/\s+(\d+)$/);
      if (m && m[1] !== '0') pids.add(m[1]);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { windowsHide: true });
        logger.info(`🔧 Processo ${pid} encerrado (porta ${port} liberada)`);
      } catch (_) {}
    }
    if (pids.size > 0) {
      // Aguarda liberação da porta
      await new Promise(r => setTimeout(r, 800));
    }
  } catch (_) {
    // Porta estava livre — nenhuma ação necessária
  }
}

async function bootstrap() {
  try {
    // ─── Libera porta se já em uso (reinicialização do app) ──
    await freePortIfBusy(PORT);

    // ─── Banco de dados ────────────────────────────
    await connectDatabase();
    logger.info('✅ PostgreSQL conectado com sucesso');

    // ─── Redis (opcional — fallback para cache em memória) ─
    const redis = await connectRedis();
    if (redis) logger.info('✅ Redis conectado com sucesso');
    else logger.info('ℹ️  Rodando sem Redis (cache em memória)');

    // ─── Monitor de processos ──────────────────────
    startProcessMonitor();
    logger.info('✅ Process Monitor Service iniciado');

    // ─── Servidor HTTP ─────────────────────────────
    const server = app.listen(PORT, () => {
      logger.info(`🏛️  JuriX API rodando na porta ${PORT}`);
      logger.info(`📡 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    });

    server.on('error', async (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.warn(`⚠️  Porta ${PORT} ainda ocupada — tentando liberar e reiniciar...`);
        await freePortIfBusy(PORT);
        setTimeout(() => server.listen(PORT), 1000);
      } else {
        logger.error('❌ Erro no servidor HTTP:', err);
        process.exit(1);
      }
    });

    // Keep-alive & timeouts for slow/4G/institutional networks
    server.keepAliveTimeout = 65000;   // slightly above common proxy timeout (60s)
    server.headersTimeout = 70000;     // must be > keepAliveTimeout
    server.requestTimeout = 300000;    // 5 min — allows long sync operations

  } catch (error) {
    logger.error('❌ Falha ao iniciar o servidor:', error);
    process.exit(1);
  }
}

// ─── Graceful shutdown ─────────────────────────────
process.on('SIGTERM', async () => {
  logger.info('SIGTERM recebido. Encerrando servidor...');
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

bootstrap();
