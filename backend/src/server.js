// Suporta DOTENV_CONFIG_PATH definido pelo Electron (app empacotado)
//
// O .env embarcado no instalador é uma cópia do arquivo de desenvolvimento
// (NODE_ENV=development, PORT=3001...). Com `override: true` ele vencia as
// variáveis que o Electron injeta no fork, e o app empacotado acabava rodando
// em modo development — com log de query do Prisma a cada requisição. Estas
// chaves são responsabilidade de quem inicia o processo, não do .env.
const CHAVES_DO_HOST = ['NODE_ENV', 'PORT', 'ELECTRON', 'SERVE_FRONTEND', 'FRONTEND_DIST', 'STORAGE_PATH', 'LOG_PATH'];
const ambienteDoHost = {};
for (const chave of CHAVES_DO_HOST) {
  if (process.env[chave] !== undefined) ambienteDoHost[chave] = process.env[chave];
}

require('dotenv').config(
  process.env.DOTENV_CONFIG_PATH
    ? { path: process.env.DOTENV_CONFIG_PATH, override: true }
    : {}
);

Object.assign(process.env, ambienteDoHost);
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
    // `netstat` pode demorar (ou travar) em máquinas com muitas conexões. Sem
    // timeout ele bloqueia o event loop e o listen abaixo nunca acontece — o
    // Electron então desiste em 45s sem nenhum log. 5s é folgado e seguro.
    const out = execSync('netstat -ano -p TCP', {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5000,
    });
    const pids = new Set();
    for (const line of out.split('\n')) {
      // Só interessa quem está OUVINDO exatamente nesta porta. Filtrar por
      // substring (":3001") pegava portas como :30010 e endereços remotos,
      // levando o taskkill a matar processos alheios.
      const m = line.trim().match(/^TCP\s+(\S+):(\d+)\s+\S+\s+LISTENING\s+(\d+)$/);
      if (!m || Number(m[2]) !== Number(port)) continue;
      const pid = m[3];
      if (pid !== '0' && Number(pid) !== process.pid) pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { windowsHide: true, timeout: 5000 });
        logger.info(`🔧 Processo ${pid} encerrado (porta ${port} liberada)`);
      } catch (_) {}
    }
    if (pids.size > 0) {
      // Aguarda liberação da porta
      await new Promise(r => setTimeout(r, 800));
    }
  } catch (_) {
    // Porta livre, netstat indisponível ou lento demais — segue o boot. Se a
    // porta estiver mesmo ocupada, o handler de EADDRINUSE abaixo cuida disso.
  }
}

async function bootstrap() {
  try {
    // ─── Libera porta se já em uso (reinicialização do app) ──
    await freePortIfBusy(PORT);

    // ─── Servidor HTTP sobe PRIMEIRO ───────────────
    // O endpoint /health é estático (não depende do banco). Subir o listen
    // antes de conectar ao banco garante que o Electron detecte o backend em
    // ~1-2s, em vez de esperar o handshake do MySQL remoto e estourar os 45s.
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

    // ─── Banco de dados + serviços em SEGUNDO PLANO ──
    // Conecta em background para não bloquear o boot da janela. As rotas /api
    // que usam o banco só serão exercidas após o login, tempo suficiente para
    // a conexão se estabelecer; se o banco cair, o app abre e reporta o erro
    // por rota em vez de travar a inicialização inteira.
    initServices();

  } catch (error) {
    logger.error('❌ Falha ao iniciar o servidor:', error);
    process.exit(1);
  }
}

// ─── Conexões que não devem bloquear o listen ───────
async function initServices() {
  try {
    await connectDatabase();
    logger.info('✅ Banco de dados conectado com sucesso');

    // ─── Redis (opcional — fallback para cache em memória) ─
    const redis = await connectRedis();
    if (redis) logger.info('✅ Redis conectado com sucesso');
    else logger.info('ℹ️  Rodando sem Redis (cache em memória)');

    // ─── Monitor de processos ──────────────────────
    startProcessMonitor();
    logger.info('✅ Process Monitor Service iniciado');
  } catch (error) {
    logger.error('❌ Falha ao conectar serviços (app segue no ar):', error);
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
