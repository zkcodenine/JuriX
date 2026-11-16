// ══════════════════════════════════════════════════════════════════
//  Isolamento entre usuários — o teste mais importante do sistema.
//
//  O JuriX separa os dados com `usuarioId: req.usuario.id` repetido em
//  dezenas de lugares. O compartilhamento troca "sou dono" por "tenho
//  acesso" nesses mesmos pontos, e um erro aqui vaza o processo de um
//  cliente para outro escritório — o pior defeito possível num sistema
//  jurídico.
// ══════════════════════════════════════════════════════════════════
'use strict';

module.exports = {
  nome: 'Isolamento entre usuários',
  precisaDeBanco: true,

  async executar({ t, req, fabrica, marca }) {
    // Alice e Bob são colegas do mesmo escritório. Carol é de OUTRO —
    // ela prova que compartilhar não atravessa unidades.
    const unidadeA = await fabrica.unidade('iso_A');
    const unidadeB = await fabrica.unidade('iso_B');

    const alice = await fabrica.usuario('iso_alice', { unidadeId: unidadeA.id });
    const bob   = await fabrica.usuario('iso_bob',   { unidadeId: unidadeA.id });
    const carol = await fabrica.usuario('iso_carol', { unidadeId: unidadeB.id });

    const criado = await fabrica.processo(alice.token, {
      numero: `${marca}-PARTICULAR`,
      classe: 'Segredo de justiça',
      partes: [{ nome: 'Cliente da Alice', tipo: 'AUTOR' }],
    });
    const proc = criado.dados;

    // ─── 1. Sem compartilhamento, Bob não vê NADA ───────────────
    const listaBob = await req('GET', '/processos', bob.token);
    t.checar('processo da Alice não aparece na lista do Bob',
      !JSON.stringify(listaBob.dados).includes(proc.id),
      `lista: ${JSON.stringify(listaBob.dados?.processos?.map((p) => p.numero))}`);

    t.status('GET processo alheio → 404', await req('GET', `/processos/${proc.id}`, bob.token), 404);
    t.status('PUT processo alheio → 404', await req('PUT', `/processos/${proc.id}`, bob.token, { classe: 'Invadido' }), 404);
    t.status('DELETE processo alheio → 404', await req('DELETE', `/processos/${proc.id}`, bob.token), 404);

    const buscaBob = await req('GET', `/processos/busca?q=${marca}-PARTICULAR`, bob.token);
    t.checar('a busca do Bob não encontra o processo da Alice',
      !JSON.stringify(buscaBob.dados).includes(proc.id));

    for (const sub of ['movimentacoes', 'tarefas', 'documentos', 'prazos', 'partes', 'anotacoes', 'honorarios']) {
      const r = await req('GET', `/processos/${proc.id}/${sub}`, bob.token);
      const vazio = r.status === 404 || (Array.isArray(r.dados) && r.dados.length === 0);
      t.checar(`sub-recurso /${sub} não vaza`, vazio,
        `status ${r.status}, corpo ${JSON.stringify(r.dados).slice(0, 80)}`);
    }

    // ─── 2. Compartilhar não atravessa escritórios ──────────────
    const comCarol = await req('POST', `/processos/${proc.id}/compartilhar`, alice.token, {
      usuarioId: carol.id, nivel: 'LEITURA',
    });
    t.status('compartilhar com usuário de OUTRA unidade é recusado', comCarol, [400, 403, 404]);

    const carolVe = await req('GET', `/processos/${proc.id}`, carol.token);
    t.status('Carol continua sem acesso → 404', carolVe, 404);

    // ─── 3. Compartilhado como LEITURA ──────────────────────────
    await req('POST', `/processos/${proc.id}/compartilhar`, alice.token, {
      usuarioId: bob.id, nivel: 'LEITURA',
    });

    t.status('Bob agora VÊ o processo → 200', await req('GET', `/processos/${proc.id}`, bob.token), 200);

    const listaBob2 = await req('GET', '/processos', bob.token);
    t.checar('o processo aparece na lista do Bob',
      JSON.stringify(listaBob2.dados).includes(proc.id));

    t.status('LEITURA não pode editar → 403',
      await req('PUT', `/processos/${proc.id}`, bob.token, { classe: 'Nao deveria' }), 403);
    t.status('LEITURA não pode criar anotação → 403',
      await req('POST', `/processos/${proc.id}/anotacoes`, bob.token, { titulo: 'x', conteudo: 'y' }), 403);
    t.status('LEITURA não pode excluir → 403',
      await req('DELETE', `/processos/${proc.id}`, bob.token), 403);
    t.status('LEITURA PODE participar do chat → 201',
      await req('POST', `/processos/${proc.id}/mensagens`, bob.token, { texto: 'oi, sou o Bob' }), 201);

    // ─── 4. Compartilhado como EDICAO ───────────────────────────
    await req('POST', `/processos/${proc.id}/compartilhar`, alice.token, {
      usuarioId: bob.id, nivel: 'EDICAO',
    });

    t.status('EDICAO pode editar → 200',
      await req('PUT', `/processos/${proc.id}`, bob.token, { classe: 'Editado pelo Bob' }), 200);
    t.status('EDICAO ainda NÃO pode excluir (só o dono) → 403',
      await req('DELETE', `/processos/${proc.id}`, bob.token), 403);
    t.status('EDICAO não pode recompartilhar (só o dono) → 403',
      await req('POST', `/processos/${proc.id}/compartilhar`, bob.token, { usuarioId: alice.id, nivel: 'EDICAO' }), 403);

    // ─── 5. Revogado ────────────────────────────────────────────
    await req('DELETE', `/processos/${proc.id}/compartilhar/${bob.id}`, alice.token);

    t.status('Bob perde o acesso → 404', await req('GET', `/processos/${proc.id}`, bob.token), 404);

    const listaFinal = await req('GET', '/processos', bob.token);
    t.checar('o processo some da lista do Bob',
      !JSON.stringify(listaFinal.dados).includes(proc.id));

    t.status('o chat fecha junto → 404',
      await req('GET', `/processos/${proc.id}/mensagens`, bob.token), 404);
  },
};
