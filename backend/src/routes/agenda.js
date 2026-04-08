const router = require('express').Router();
const auth   = require('../middlewares/auth');
const ctrl   = require('../controllers/agendaController');

router.use(auth);

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
