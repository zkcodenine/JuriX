const router = require('express').Router();
const auth   = require('../middlewares/auth');
const { bloqueiaEscritaSemPlano } = require('../middlewares/limitePlano');
const ctrl   = require('../controllers/agendaController');

router.use(auth);
// Cota do plano gratuito: acima de 5 processos a conta sem plano ativo entra
// em modo somente-leitura ate assinar (ou excluir processos). GET e DELETE
// continuam liberados de proposito — ver middlewares/limitePlano.js.
router.use(bloqueiaEscritaSemPlano);

// Etiquetas
router.get   ('/etiquetas',      ctrl.listarEtiquetas);
router.post  ('/etiquetas',      ctrl.criarEtiqueta);
router.put   ('/etiquetas/:id',  ctrl.atualizarEtiqueta);
router.delete('/etiquetas/:id',  ctrl.deletarEtiqueta);

// Eventos
router.get   ('/eventos',      ctrl.listarEventos);
router.post  ('/eventos',      ctrl.criarEvento);
router.put   ('/eventos/:id',  ctrl.atualizarEvento);
router.delete('/eventos/:id',  ctrl.deletarEvento);

module.exports = router;
