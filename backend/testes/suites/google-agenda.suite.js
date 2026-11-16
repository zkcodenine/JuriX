// ══════════════════════════════════════════════════════════════════
//  Sincronização com a Google Agenda.
//
//  O teste NÃO chama o Google de verdade (seria flaky e dependeria da
//  conta do usuário). Ele cobre as duas coisas que de fato quebram:
//
//    1. COMPORTAMENTO — com o Google indisponível, toda ação do app
//       continua funcionando. A sincronização é best-effort: se ela
//       puder derrubar um cadastro, o advogado perde o compromisso.
//
//    2. FIAÇÃO — cada ação que mexe em algo com data precisa chamar o
//       serviço do Google. Era aqui que faltavam pedaços: parcela paga
//       continuava cobrando na agenda, processo excluído deixava os
//       prazos órfãos e quem conectava a conta depois não via nada do
//       que já estava salvo.
// ══════════════════════════════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'src');
const ler = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

const emDias = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

module.exports = {
  nome: 'Google Agenda (sincronização)',
  precisaDeBanco: true,

  async executar({ t, req, fabrica, prisma, marca }) {
    const dono = await fabrica.usuario('gcal_dono');

    // ═══ 1. Comportamento com o Google indisponível ═══════════════
    const status = await req('GET', '/google/status', dono.token);
    t.status('GET /google/status → 200', status, 200);
    t.checar('usuário novo começa desconectado', status.dados?.conectado === false);

    const sincronizar = await req('POST', '/google/sincronizar', dono.token, {});
    t.status('sincronizar sem conta conectada → 400 (mensagem clara)', sincronizar, 400);
    t.checar('a resposta explica o motivo', typeof sincronizar.dados?.error === 'string'
      && sincronizar.dados.error.length > 10, `veio ${JSON.stringify(sincronizar.dados)}`);

    // Evento da agenda
    const evento = await req('POST', '/agenda/eventos', dono.token, {
      titulo: 'Audiência', data: emDias(5), horario: '10:00',
    });
    t.status('criar evento funciona sem Google → 201', evento, 201);
    t.checar('sem Google, googleEventId fica nulo (nada inventado)',
      !evento.dados?.googleEventId, `veio ${evento.dados?.googleEventId}`);

    const eventoEditado = await req('PUT', `/agenda/eventos/${evento.dados.id}`, dono.token, {
      horario: '15:00',
    });
    t.status('editar evento funciona sem Google → 200', eventoEditado, 200);

    const eventoExcluido = await req('DELETE', `/agenda/eventos/${evento.dados.id}`, dono.token);
    t.status('excluir evento funciona sem Google → 200', eventoExcluido, 200);

    // Tarefa com prazo
    const tarefa = await req('POST', '/tarefas', dono.token, {
      titulo: 'Protocolar recurso', prazo: emDias(3), googleSync: true,
    });
    t.status('criar tarefa com prazo funciona sem Google → 201', tarefa, 201);

    const tarefaConcluida = await req('PUT', `/tarefas/${tarefa.dados.id}`, dono.token, {
      status: 'CONCLUIDA',
    });
    t.status('concluir tarefa funciona sem Google → 200', tarefaConcluida, 200);

    // Prazo de processo
    const proc = await fabrica.processo(dono.token, { numero: `${marca}-GCAL` });
    const prazo = await req('POST', `/processos/${proc.dados.id}/prazos`, dono.token, {
      titulo: 'Embargos', dataVencimento: emDias(10), googleSync: true,
    });
    t.status('criar prazo de processo funciona sem Google → 201', prazo, 201);

    // Honorário com parcelas
    const honorario = await req('POST', '/honorarios', dono.token, {
      processoId: proc.dados.id,
      valorTotal: 3000,
      descricao: 'Honorários contratuais',
      parcelas: [
        { valor: 1500, vencimento: emDias(30) },
        { valor: 1500, vencimento: emDias(60) },
      ],
    });
    t.status('criar honorário com parcelas funciona sem Google → 201', honorario, 201);
    t.checar('as 2 parcelas são criadas', honorario.dados?.parcelas?.length === 2,
      `vieram ${honorario.dados?.parcelas?.length}`);

    const parcela = honorario.dados.parcelas[0];
    const paga = await req('PUT', `/honorarios/${honorario.dados.id}/parcelas/${parcela.id}`,
      dono.token, { status: 'PAGO', dataPagamento: new Date().toISOString() });
    t.status('marcar parcela como paga funciona sem Google → 200', paga, 200);
    t.checar('parcela paga não fica com lembrete pendurado',
      !paga.dados?.googleEventId, `veio ${paga.dados?.googleEventId}`);

    const excluirProcesso = await req('DELETE', `/processos/${proc.dados.id}`, dono.token);
    t.status('excluir processo (limpa agenda antes) funciona sem Google → 200', excluirProcesso, 200);

    // ═══ 2. Fiação: cada ação precisa falar com o Google ══════════
    // Checagem estrutural. É o único jeito de garantir, sem uma conta
    // Google real no CI, que ninguém removeu a sincronização sem querer.
    const fiacao = [
      ['evento criado vai para o Google',
        'controllers/agendaController.js', 'criarEventoGoogle'],
      ['evento editado atualiza no Google',
        'controllers/agendaController.js', 'atualizarEventoGoogle'],
      ['evento excluído sai do Google',
        'controllers/agendaController.js', 'deletarEventoGoogle'],

      ['prazo de tarefa vai para o Google',
        'routes/tarefas.js', 'sincronizarPrazoTarefa'],
      ['tarefa excluída tira o lembrete do Google',
        'routes/tarefas.js', 'deletarEventoGoogle'],

      ['prazo de processo vai para o Google',
        'controllers/processosController.js', 'sincronizarPrazoProcesso'],
      ['processo excluído limpa os eventos do Google',
        'controllers/processosController.js', 'limparEventosDoProcesso'],

      ['vencimento de parcela vai para o Google',
        'routes/honorarios.js', 'sincronizarParcela'],
      ['parcela alterada é re-sincronizada',
        'routes/honorarios.js', 'sincronizarParcelaGoogle'],
      ['mudar o opt-in do honorário propaga para as parcelas',
        'routes/honorarios.js', 'sincronizarParcelasDoHonorario'],

      ['conectar a conta dispara o envio retroativo',
        'routes/google.js', 'sincronizarTudo'],
    ];

    for (const [descricao, arquivo, simbolo] of fiacao) {
      let conteudo = '';
      try { conteudo = ler(arquivo); } catch (e) { /* arquivo sumiu */ }
      t.checar(descricao, conteudo.includes(simbolo),
        `${arquivo} não menciona ${simbolo}()`);
    }

    // O serviço precisa expor as funções que as rotas chamam.
    const gcal = require('../../src/services/googleCalendarService');
    for (const fn of [
      'criarEventoGoogle', 'atualizarEventoGoogle', 'deletarEventoGoogle',
      'sincronizarPrazoTarefa', 'sincronizarPrazoProcesso', 'sincronizarParcela',
      'sincronizarTudo', 'limparEventosDoProcesso',
    ]) {
      t.checar(`o serviço exporta ${fn}()`, typeof gcal[fn] === 'function');
    }

    // ═══ 3. O backfill é idempotente e não explode desconectado ═══
    const resumo = await gcal.sincronizarTudo(dono.id);
    t.checar('sincronizarTudo devolve resumo em vez de lançar erro',
      resumo && typeof resumo === 'object' && 'eventos' in resumo,
      `veio ${JSON.stringify(resumo)}`);
    t.checar('e explica por que não sincronizou', Boolean(resumo.ignorado),
      `veio ${JSON.stringify(resumo)}`);

    // Nada pode ter sido marcado como sincronizado sem conexão.
    const comEventoId = await prisma.eventoAgenda.count({
      where: { usuarioId: dono.id, googleEventId: { not: null } },
    });
    t.checar('nenhum evento foi marcado como sincronizado indevidamente',
      comEventoId === 0, `${comEventoId} evento(s) com googleEventId`);
  },
};
