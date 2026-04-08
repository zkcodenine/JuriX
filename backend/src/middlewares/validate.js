const { validationResult } = require('express-validator');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Dados inválidos.',
      detalhes: errors.array().map(e => ({ campo: e.path, mensagem: e.msg })),
    });
  }
  next();
}

module.exports = validate;
