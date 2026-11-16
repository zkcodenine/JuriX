// ══════════════════════════════════════════════════════════════════
//  Agenda — etiquetas e eventos.
//
//  O botão "+" do modal de evento cria a etiqueta pela MESMA rota que
//  a tela "Gerenciar Etiquetas" (POST /agenda/etiquetas) e já deixa o
//  evento apontando para ela. Por isso o teste cobre o ciclo inteiro:
//  criar etiqueta → criar evento com ela → listar → trocar → excluir.
// ══════════════════════════════════════════════════════════════════
'use strict';

const hoje = new Date();
const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
const diaDoMes = (dia) => `${mesAtual}-${String(dia).padStart(2, '0')}`;

module.exports = {
  nome: 'Agenda',
  precisaDeBanco: true,

  async executar({ t, req, fabrica }) {
    const dono = await fabrica.usuario('agenda_dono');

    // ─── Etiquetas ──────────────────────────────────────────────
    const etiqueta = await req('POST', '/agenda/etiquetas', dono.token, {
      nome: 'Audiência', cor: '#ef4444',
    });
    t.status('POST /agenda/etiquetas → 201', etiqueta, 201);
    t.checar('a cor enviada é respeitada', etiqueta.dados?.cor === '#ef4444',
      `veio ${etiqueta.dados?.cor}`);

    const semNome = await req('POST', '/agenda/etiquetas', dono.token, { cor: '#fff' });
    t.status('etiqueta sem nome → 400', semNome, 400);

    const corPadrao = await req('POST', '/agenda/etiquetas', dono.token, { nome: 'Reunião' });
    t.checar('sem cor, usa o dourado padrão', corPadrao.dados?.cor === '#C9A84C',
      `veio ${corPadrao.dados?.cor}`);

    const listaEtiquetas = await req('GET', '/agenda/etiquetas', dono.token);
    t.status('GET /agenda/etiquetas → 200', listaEtiquetas, 200);
    t.checar('as 2 etiquetas aparecem', listaEtiquetas.dados?.length >= 2);

    // ─── Eventos ────────────────────────────────────────────────
    const evento = await req('POST', '/agenda/eventos', dono.token, {
      titulo: 'Audiência de conciliação',
      data: diaDoMes(15),
      horario: '14:00',
      descricao: 'Fórum central, sala 3',
      etiquetaId: etiqueta.dados.id,
    });
    t.status('POST /agenda/eventos → 201', evento, 201);
    t.checar('o evento nasce com a etiqueta vinculada',
      evento.dados?.etiqueta?.id === etiqueta.dados.id,
      `veio ${JSON.stringify(evento.dados?.etiqueta)}`);

    const id = evento.dados.id;

    const semTitulo = await req('POST', '/agenda/eventos', dono.token, { data: diaDoMes(10) });
    t.status('evento sem título → 400', semTitulo, 400);

    const semData = await req('POST', '/agenda/eventos', dono.token, { titulo: 'Sem data' });
    t.status('evento sem data → 400', semData, 400);

    const semEtiqueta = await req('POST', '/agenda/eventos', dono.token, {
      titulo: 'Compromisso solto', data: diaDoMes(20), etiquetaId: null,
    });
    t.status('evento sem etiqueta é permitido → 201', semEtiqueta, 201);

    // ─── Listagem por mês ───────────────────────────────────────
    const doMes = await req('GET', `/agenda/eventos?mes=${mesAtual}`, dono.token);
    t.status('GET /agenda/eventos?mes= → 200', doMes, 200);
    t.checar('o evento do mês aparece', doMes.dados?.some((e) => e.id === id));
    t.checar('a listagem traz a etiqueta embutida (para pintar o card)',
      Boolean(doMes.dados?.find((e) => e.id === id)?.etiqueta));

    const outroMes = await req('GET', '/agenda/eventos?mes=1999-01', dono.token);
    t.checar('mês sem eventos volta vazio', outroMes.dados?.length === 0,
      `vieram ${outroMes.dados?.length}`);

    // ─── Atualizar ──────────────────────────────────────────────
    const trocaEtiqueta = await req('PUT', `/agenda/eventos/${id}`, dono.token, {
      titulo: 'Audiência de instrução',
      etiquetaId: corPadrao.dados.id,
    });
    t.status('PUT /agenda/eventos/:id → 200', trocaEtiqueta, 200);
    t.checar('a etiqueta é trocada', trocaEtiqueta.dados?.etiqueta?.id === corPadrao.dados.id,
      `veio ${trocaEtiqueta.dados?.etiqueta?.id}`);

    const tiraEtiqueta = await req('PUT', `/agenda/eventos/${id}`, dono.token, { etiquetaId: null });
    t.checar('dá para remover a etiqueta do evento', tiraEtiqueta.dados?.etiquetaId === null,
      `veio ${tiraEtiqueta.dados?.etiquetaId}`);

    // ─── Excluir etiqueta não leva o evento junto ───────────────
    // O schema usa onDelete: SetNull. Se virar Cascade, apagar uma
    // etiqueta apagaria compromissos — perda de dado silenciosa.
    const eventoComEtiqueta = await req('POST', '/agenda/eventos', dono.token, {
      titulo: 'Prazo recursal', data: diaDoMes(25), etiquetaId: corPadrao.dados.id,
    });
    await req('DELETE', `/agenda/etiquetas/${corPadrao.dados.id}`, dono.token);

    const sobreviveu = await req('GET', `/agenda/eventos?mes=${mesAtual}`, dono.token);
    const aindaLa = sobreviveu.dados?.find((e) => e.id === eventoComEtiqueta.dados.id);
    t.checar('excluir a etiqueta NÃO apaga o evento', Boolean(aindaLa));
    t.checar('o evento fica apenas sem etiqueta', aindaLa?.etiquetaId === null,
      `veio ${aindaLa?.etiquetaId}`);

    // ─── Isolamento ─────────────────────────────────────────────
    const outro = await fabrica.usuario('agenda_outro');
    const espiar = await req('GET', `/agenda/eventos?mes=${mesAtual}`, outro.token);
    t.checar('eventos não vazam para outro usuário', espiar.dados?.length === 0,
      `vieram ${espiar.dados?.length}`);

    const editarAlheio = await req('PUT', `/agenda/eventos/${id}`, outro.token, { titulo: 'invadido' });
    t.status('editar evento alheio → 404', editarAlheio, 404);

    const etiquetasAlheias = await req('GET', '/agenda/etiquetas', outro.token);
    t.checar('etiquetas não vazam entre usuários', etiquetasAlheias.dados?.length === 0,
      `vieram ${etiquetasAlheias.dados?.length}`);

    // ─── Excluir ────────────────────────────────────────────────
    const excluido = await req('DELETE', `/agenda/eventos/${id}`, dono.token);
    t.status('DELETE /agenda/eventos/:id → 200', excluido, 200);

    const sumiu = await req('GET', `/agenda/eventos?mes=${mesAtual}`, dono.token);
    t.checar('o evento excluído some da listagem', !sumiu.dados?.some((e) => e.id === id));
  },
};
