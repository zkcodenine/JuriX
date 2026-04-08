const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');
const { cacheGet, cacheSet } = require('../config/redis');

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expirado. Faça login novamente.' });
      }
      return res.status(401).json({ error: 'Token inválido.' });
    }

    // ─── Cache do usuário ──────────────────────────
    const cacheKey = `user:${decoded.id}`;
    let usuario = await cacheGet(cacheKey);

    if (!usuario) {
      usuario = await prisma.usuario.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          nome: true,
          email: true,
          oab: true,
          plano: true,
          planoExpiracao: true,
          ativo: true,
        },
      });

      if (!usuario) {
        return res.status(401).json({ error: 'Usuário não encontrado.' });
      }

      await cacheSet(cacheKey, usuario, 300); // 5 min cache
    }

    if (!usuario.ativo) {
      return res.status(403).json({ error: 'Conta desativada. Entre em contato com o suporte.' });
    }

    req.usuario = usuario;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = authMiddleware;
