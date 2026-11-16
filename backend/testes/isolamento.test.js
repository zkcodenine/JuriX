// ══════════════════════════════════════════════════════════════════
//  Mantido como atalho: o teste de isolamento virou uma suíte dentro
//  do executor de regressão (testes/suites/isolamento.suite.js), para
//  compartilhar o harness com as demais e limpar o banco do mesmo jeito.
//
//  Este arquivo existe só para quem já tinha o comando antigo na mão.
//
//    node testes/isolamento.test.js      ← continua funcionando
//    node testes/executar.js isolamento  ← equivalente
//    node testes/executar.js             ← tudo
// ══════════════════════════════════════════════════════════════════
'use strict';

process.argv = [process.argv[0], process.argv[1], 'isolamento'];
require('./executar.js');
