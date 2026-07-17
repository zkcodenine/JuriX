const router = require('express').Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/auth');
const validate = require('../middlewares/validate');

// GET /api/auth/health — connectivity check (no auth required)
router.get('/health', (_req, res) => res.json({ ok: true }));

// POST /api/auth/registrar
router.post('/registrar', [
  body('nome').trim().notEmpty().withMessage('Nome obrigatório'),
  body('email').isEmail().withMessage('E-mail inválido').normalizeEmail(),
  body('senha').isLength({ min: 8 }).withMessage('Senha deve ter no mínimo 8 caracteres'),
  body('aceitouTermos').equals('true').withMessage('Você deve aceitar os Termos de Uso'),
  validate,
], authController.registrar);

// POST /api/auth/login
// O campo `email` aceita CPF OU e-mail. O nome foi mantido para não quebrar os
// apps já instalados, que enviam { email, senha }. Antes havia um isEmail()
// aqui, que rejeitaria um CPF com 400 antes de chegar ao controller.
router.post('/login', [
  body('email').trim().notEmpty().withMessage('Informe seu CPF ou e-mail')
    .custom((valor) => {
      const soDigitos = String(valor).replace(/\D/g, '');
      if (/^\d{11}$/.test(soDigitos)) return true;          // CPF
      if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valor)) return true; // e-mail
      throw new Error('Informe um CPF (11 dígitos) ou um e-mail válido');
    }),
  body('senha').notEmpty().withMessage('Senha obrigatória'),
  validate,
], authController.login);

// GET /api/auth/me
router.get('/me', authMiddleware, authController.me);

// PUT /api/auth/perfil
router.put('/perfil', authMiddleware, authController.atualizarPerfil);

// POST /api/auth/alterar-senha
router.post('/alterar-senha', authMiddleware, [
  body('senhaAtual').notEmpty().withMessage('Senha atual obrigatória'),
  body('novaSenha').isLength({ min: 8 }).withMessage('Nova senha deve ter no mínimo 8 caracteres'),
  validate,
], authController.alterarSenha);

// POST /api/auth/avatar  (multipart/form-data, campo: avatar)
router.post('/avatar', authMiddleware, authController.uploadAvatarHandler);

// POST /api/auth/dev-activate — ativa plano vitalício com código secreto
router.post('/dev-activate', authMiddleware, authController.devActivate);

module.exports = router;
