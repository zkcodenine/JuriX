const router = require('express').Router();

router.use('/auth', require('./auth'));
router.use('/processos', require('./processos'));
router.use('/tarefas', require('./tarefas'));
router.use('/documentos', require('./documentos'));
router.use('/honorarios', require('./honorarios'));
router.use('/notificacoes', require('./notificacoes'));
router.use('/dashboard', require('./dashboard'));
router.use('/pagamentos', require('./pagamentos'));
router.use('/configuracoes', require('./configuracoes'));
router.use('/agenda',        require('./agenda'));

module.exports = router;
