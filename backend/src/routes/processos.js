const router = require('express').Router();
const { body, param } = require('express-validator');
const ctrl = require('../controllers/processosController');
const compart = require('../controllers/compartilhamentoController');
const auth = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const auditLog = require('../middlewares/audit');
const requerPlanoPago = require('../middlewares/requerPlanoPago');

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
// Integração DataJud/CNJ é exclusiva dos planos pagos.
router.post('/importar-cnj', requerPlanoPago('A integração DataJud/CNJ'), [
  body('numeroCnj').notEmpty().withMessage('Número CNJ obrigatório'),
  body('tribunal').notEmpty().withMessage('Tribunal obrigatório'),
  validate,
], auditLog('IMPORTAR_CNJ', 'PROCESSO'), ctrl.importarCNJ);

// ─── Vincular processo ao CNJ ──────────────────────
router.post('/:id/vincular-cnj', requerPlanoPago('A integração DataJud/CNJ'), [
  param('id').isUUID(),
  body('numeroCnj').notEmpty(),
  body('tribunal').notEmpty(),
  validate,
], ctrl.vincularCNJ);

// ─── Confirmar vinculação CNJ (salva dados) ─────────
router.post('/:id/confirmar-cnj', requerPlanoPago('A integração DataJud/CNJ'), [
  param('id').isUUID(),
  body('numeroCnj').notEmpty(),
  body('tribunal').notEmpty(),
  validate,
], ctrl.confirmarVinculacaoCNJ);

// ─── Monitoramento ─────────────────────────────────
// Monitoramento automático é exclusivo dos planos pagos.
router.post('/:id/monitoramento/ativar', requerPlanoPago('O monitoramento automático'), ctrl.ativarMonitoramento);
router.post('/:id/monitoramento/desativar', ctrl.desativarMonitoramento);

// ─── Sincronizar movimentações (forçar atualização) ──
// Sincronização usa DataJud/CNJ → exclusiva dos planos pagos.
router.post('/sincronizar-todos', requerPlanoPago('A sincronização de movimentações'), ctrl.sincronizarTodos);
router.post('/:id/sincronizar', requerPlanoPago('A sincronização de movimentações'), ctrl.sincronizarMovimentacoes);

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

// ─── Compartilhamento (Fase 2) ─────────────────────
// Quem tem acesso, e com quem dá para compartilhar (colegas da mesma unidade).
router.get('/:id/compartilhamentos', compart.listar);
router.get('/:id/compartilhar-com', compart.candidatos);
router.post('/:id/compartilhar', [
  body('usuarioId').isUUID().withMessage('Usuário inválido'),
  validate,
], auditLog('COMPARTILHAR', 'PROCESSO'), compart.compartilhar);
router.delete('/:id/compartilhar/:usuarioId', auditLog('DESCOMPARTILHAR', 'PROCESSO'), compart.revogar);

// ─── Chat de discussão (Fase 3) ────────────────────
router.get('/:id/mensagens', compart.mensagens);
router.post('/:id/mensagens', compart.enviarMensagem);
router.delete('/:id/mensagens/:mensagemId', compart.removerMensagem);

// ─── Anotações ─────────────────────────────────────
router.post('/:id/anotacoes', ctrl.adicionarAnotacao);
router.put('/:id/anotacoes/:anotacaoId', ctrl.atualizarAnotacao);
router.delete('/:id/anotacoes/:anotacaoId', ctrl.deletarAnotacao);

module.exports = router;
