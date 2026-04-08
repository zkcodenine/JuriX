const router = require('express').Router();
const { body, param } = require('express-validator');
const ctrl = require('../controllers/processosController');
const auth = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const auditLog = require('../middlewares/audit');

router.use(auth);

// ─── CRUD de processos ─────────────────────────────
router.get('/', ctrl.listar);
router.post('/', auditLog('CRIAR', 'PROCESSO'), ctrl.criar);
router.get('/busca',         ctrl.buscar);
router.get('/prazos-agenda', ctrl.prazosAgenda);
router.get('/movimentacoes-agenda', ctrl.movimentacoesAgenda);
router.get('/:id', ctrl.obter);
router.put('/:id', auditLog('ATUALIZAR', 'PROCESSO'), ctrl.atualizar);
router.delete('/:id', auditLog('DELETAR', 'PROCESSO'), ctrl.deletar);

// ─── Importar via CNJ / DataJud ────────────────────
router.post('/importar-cnj', [
  body('numeroCnj').notEmpty().withMessage('Número CNJ obrigatório'),
  body('tribunal').notEmpty().withMessage('Tribunal obrigatório'),
  validate,
], auditLog('IMPORTAR_CNJ', 'PROCESSO'), ctrl.importarCNJ);

// ─── Vincular processo ao CNJ ──────────────────────
router.post('/:id/vincular-cnj', [
  param('id').isUUID(),
  body('numeroCnj').notEmpty(),
  body('tribunal').notEmpty(),
  validate,
], ctrl.vincularCNJ);

// ─── Confirmar vinculação CNJ (salva dados) ─────────
router.post('/:id/confirmar-cnj', [
  param('id').isUUID(),
  body('numeroCnj').notEmpty(),
  body('tribunal').notEmpty(),
  validate,
], ctrl.confirmarVinculacaoCNJ);

// ─── Monitoramento ─────────────────────────────────
router.post('/:id/monitoramento/ativar', ctrl.ativarMonitoramento);
router.post('/:id/monitoramento/desativar', ctrl.desativarMonitoramento);

// ─── Sincronizar movimentações (forçar atualização) ──
router.post('/sincronizar-todos', ctrl.sincronizarTodos);
router.post('/:id/sincronizar', ctrl.sincronizarMovimentacoes);

// ─── Sub-recursos ──────────────────────────────────
router.get('/:id/movimentacoes', ctrl.movimentacoes);
router.get('/:id/tarefas', ctrl.tarefas);
router.get('/:id/documentos', ctrl.documentos);
router.get('/:id/honorarios', ctrl.honorarios);
router.get('/:id/prazos', ctrl.prazos);
router.get('/:id/partes', ctrl.partes);
router.get('/:id/anotacoes', ctrl.anotacoes);

// ─── Partes ────────────────────────────────────────
router.post('/:id/partes', ctrl.adicionarParte);
router.delete('/:id/partes/:parteId', ctrl.removerParte);

// ─── Movimentações manuais ─────────────────────────
router.post('/:id/movimentacoes', ctrl.adicionarMovimentacao);
router.delete('/:id/movimentacoes/:movId', ctrl.deletarMovimentacao);

// ─── Prazos ────────────────────────────────────────
router.post('/:id/prazos', ctrl.adicionarPrazo);
router.put('/:id/prazos/:prazoId', ctrl.atualizarPrazo);
router.delete('/:id/prazos/:prazoId', ctrl.deletarPrazo);

// ─── Anotações ─────────────────────────────────────
router.post('/:id/anotacoes', ctrl.adicionarAnotacao);
router.put('/:id/anotacoes/:anotacaoId', ctrl.atualizarAnotacao);
router.delete('/:id/anotacoes/:anotacaoId', ctrl.deletarAnotacao);

module.exports = router;
