const router = require('express').Router();
const auth = require('../middlewares/auth');
const notificationService = require('../services/notificationService');

router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const { pagina, limite, apenasNaoLidas } = req.query;
    const resultado = await notificationService.listarNotificacoes(req.usuario.id, {
      pagina: Number(pagina) || 1,
      limite: Number(limite) || 30,
      apenasNaoLidas: apenasNaoLidas === 'true',
    });
    res.json(resultado);
  } catch (err) { next(err); }
});

router.patch('/:id/ler', async (req, res, next) => {
  try {
    await notificationService.marcarComoLida(req.params.id, req.usuario.id);
    res.json({ mensagem: 'Notificação marcada como lida.' });
  } catch (err) { next(err); }
});

router.patch('/ler-por-processo/:processoId', async (req, res, next) => {
  try {
    await notificationService.marcarComoLidaPorProcesso(req.params.processoId, req.usuario.id);
    res.json({ mensagem: 'Notificações do processo marcadas como lidas.' });
  } catch (err) { next(err); }
});

router.patch('/ler-todas', async (req, res, next) => {
  try {
    await notificationService.marcarTodasComoLidas(req.usuario.id);
    res.json({ mensagem: 'Todas as notificações marcadas como lidas.' });
  } catch (err) { next(err); }
});

module.exports = router;
