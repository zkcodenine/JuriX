const logger = require('./logger');

let redisClient = null;
let redisDisponivel = false;

// ─── Conectar (Redis é OPCIONAL — fallback para memória) ─
async function connectRedis() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl || process.env.REDIS_DISABLED === 'true') {
    logger.warn('⚠️  Redis não configurado — cache em memória ativo (modo dev)');
    return null;
  }

  try {
    const Redis = require('ioredis');
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      connectTimeout: 4000,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 2) { redisDisponivel = false; return null; }
        return Math.min(times * 300, 1000);
      },
    });

    redisClient.on('error', () => { redisDisponivel = false; });
    redisClient.on('connect', () => { redisDisponivel = true; logger.info('✅ Redis conectado'); });

    await redisClient.connect();
    await redisClient.ping();
    redisDisponivel = true;
    return redisClient;
  } catch (err) {
    logger.warn(`Redis indisponível (${err.message}) — cache em memória ativo`);
    redisClient = null;
    redisDisponivel = false;
    return null;
  }
}

function getRedisClient() { return redisClient; }

// ─── Cache em memória (fallback quando Redis não disponível) ─
const _mem = new Map();
const _ttl = new Map();

const mem = {
  get(key) {
    const exp = _ttl.get(key);
    if (exp && Date.now() > exp) { _mem.delete(key); _ttl.delete(key); return null; }
    return _mem.has(key) ? _mem.get(key) : null;
  },
  set(key, value, ttlSec) {
    _mem.set(key, value);
    if (ttlSec) _ttl.set(key, Date.now() + ttlSec * 1000);
  },
  del(key) { _mem.delete(key); _ttl.delete(key); },
  delPattern(prefix) {
    const p = prefix.replace(/\*/g, '');
    for (const k of _mem.keys()) if (k.startsWith(p)) { _mem.delete(k); _ttl.delete(k); }
  },
};

// ─── API unificada de cache ────────────────────────
async function cacheGet(key) {
  try {
    if (redisDisponivel && redisClient) {
      const d = await redisClient.get(key);
      return d ? JSON.parse(d) : null;
    }
  } catch (_) {}
  return mem.get(key);
}

async function cacheSet(key, value, ttlSeconds = 300) {
  try {
    if (redisDisponivel && redisClient) {
      await redisClient.setex(key, ttlSeconds, JSON.stringify(value)); return;
    }
  } catch (_) {}
  mem.set(key, value, ttlSeconds);
}

async function cacheDel(key) {
  try { if (redisDisponivel && redisClient) { await redisClient.del(key); return; } } catch (_) {}
  mem.del(key);
}

async function cacheDelPattern(pattern) {
  try {
    if (redisDisponivel && redisClient) {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) await redisClient.del(...keys);
      return;
    }
  } catch (_) {}
  mem.delPattern(pattern);
}

module.exports = { getRedisClient, connectRedis, cacheGet, cacheSet, cacheDel, cacheDelPattern };
