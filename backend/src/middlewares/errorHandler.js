const logger = require('../config/logger');

function errorHandler(err, req, res, next) {
  logger.error(err.message, {
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    usuarioId: req.usuario?.id,
  });

  // Prisma known request errors
  if (err.code === 'P2002') {
    const campo = err.meta?.target?.[0] || err.meta?.target || 'campo';
    logger.warn(`P2002 unique violation no campo: ${JSON.stringify(err.meta)}`);
    return res.status(409).json({ error: `Registro duplicado no campo "${campo}". Este dado já existe no sistema.` });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Registro não encontrado.' });
  }
  if (err.code === 'P2003') {
    return res.status(400).json({ error: 'Referência inválida.' });
  }
  if (err.code === 'P2006' || err.code === 'P2009' || err.code === 'P2007') {
    return res.status(400).json({ error: 'Dado inválido: verifique os campos enviados.' });
  }
  // Banco remoto inacessível / conexão derrubada / pool esgotado. Sem isto, uma
  // queda momentânea do MySQL virava um "Erro interno do servidor" genérico,
  // indistinguível de um bug de código.
  if (['P1001', 'P1002', 'P1008', 'P1017', 'P2024'].includes(err.code)) {
    return res.status(503).json({
      error: 'Sem conexão com o banco de dados. Verifique sua internet e tente novamente em instantes.',
    });
  }
  // Prisma validation error (campo desconhecido, tipo errado, campo obrigatório ausente)
  if (err.name === 'PrismaClientValidationError') {
    const match = err.message.match(/Unknown argument `(\w+)`/) ||
                  err.message.match(/Got invalid value .+ on prisma\.\w+\.\w+\. Provided .+, expected (.+)\./) ||
                  err.message.match(/Argument `(\w+)` is missing/);
    const detail = match ? match[1] : null;
    return res.status(400).json({
      error: detail
        ? `Campo inválido ou ausente: ${detail}`
        : 'Dados inválidos. Verifique os campos e tente novamente.',
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Arquivo muito grande. Limite: 50MB.' });
  }

  const statusCode = err.statusCode || 500;
  const message = statusCode < 500
    ? err.message
    : 'Erro interno do servidor. Tente novamente.';

  res.status(statusCode).json({ error: message });
}

module.exports = errorHandler;
