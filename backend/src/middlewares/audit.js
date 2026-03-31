const { prisma } = require('../config/database');

function auditLog(acao, entidade) {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = async (body) => {
      // Registra log apenas em operações de escrita bem-sucedidas
      if (req.usuario && res.statusCode < 400) {
        try {
          await prisma.auditLog.create({
            data: {
              usuarioId: req.usuario.id,
              acao,
              entidade,
              entidadeId: body?.id || req.params?.id || null,
              dados: {
                method: req.method,
                path: req.path,
                body: req.method !== 'GET' ? sanitizeBody(req.body) : undefined,
              },
              ip: req.ip,
            },
          });
        } catch (_) {
          // Não bloqueia a resposta por falha no log
        }
      }
      return originalJson(body);
    };

    next();
  };
}

function sanitizeBody(body) {
  if (!body) return undefined;
  const { senha, password, token, ...rest } = body;
  return rest;
}

module.exports = auditLog;
