// ══════════════════════════════════════════════════════════════════
//  Processos — CRUD e busca.
//
//  A busca ganhou `classe` (o tipo de ação), `tribunal` e `vara`
//  porque o seletor de processo da tarefa procura por eles. Se alguém
//  remover esses campos do OR, o seletor volta a só achar por número.
// ══════════════════════════════════════════════════════════════════
'use strict';

module.exports = {
  nome: 'Processos',
  precisaDeBanco: true,

  async executar({ t, req, fabrica, marca }) {
    const dono = await fabrica.usuario('proc_dono');

    // ─── Criar ──────────────────────────────────────────────────
    const criado = await fabrica.processo(dono.token, {
      numero: `${marca}-0001`,
      numeroCnj: `0001234-55.2026.8.26.${String(Date.now()).slice(-4)}`,
      classe: 'Execução Fiscal',
      assunto: 'Dívida Ativa',
      tribunal: 'TJSP',
      vara: '3ª Vara da Fazenda',
      partes: [{ nome: 'Construtora Horizonte Ltda', tipo: 'AUTOR' }],
    });
    t.status('POST /processos → 201', criado, 201);
    t.checar('processo criado traz id', Boolean(criado.dados?.id));
    t.checar('partes são criadas junto', criado.dados?.partes?.length === 1,
      `veio ${JSON.stringify(criado.dados?.partes)}`);

    const id = criado.dados.id;

    // ─── Obter ──────────────────────────────────────────────────
    const obtido = await req('GET', `/processos/${id}`, dono.token);
    t.status('GET /processos/:id → 200', obtido, 200);
    t.checar('traz a classe gravada', obtido.dados?.classe === 'Execução Fiscal',
      `veio ${obtido.dados?.classe}`);

    // ─── Listar ─────────────────────────────────────────────────
    const lista = await req('GET', '/processos', dono.token);
    t.status('GET /processos → 200', lista, 200);
    t.checar('lista vem paginada { processos, total }',
      Array.isArray(lista.dados?.processos) && typeof lista.dados?.total === 'number');
    t.checar('o processo criado aparece na lista',
      lista.dados.processos.some((p) => p.id === id));

    // ─── Busca ──────────────────────────────────────────────────
    // Cada campo testado separadamente: é assim que o usuário procura.
    const casos = [
      ['pelo número',              `${marca}-0001`],
      ['pelo tipo de ação (classe)', 'Execução Fiscal'],
      ['pelo nome da parte',       'Construtora Horizonte'],
      ['pelo assunto',             'Dívida Ativa'],
      ['pelo tribunal',            'TJSP'],
      ['pela vara',                'Fazenda'],
    ];
    for (const [descricao, termo] of casos) {
      const r = await req('GET', `/processos?busca=${encodeURIComponent(termo)}`, dono.token);
      t.checar(
        `busca ${descricao} encontra o processo`,
        r.status === 200 && r.dados?.processos?.some((p) => p.id === id),
        `termo "${termo}" → status ${r.status}, ${r.dados?.processos?.length ?? '?'} resultado(s)`
      );
    }

    const semResultado = await req('GET', `/processos?busca=${marca}-inexistente-zzz`, dono.token);
    t.checar('busca sem correspondência volta vazia',
      semResultado.dados?.processos?.length === 0,
      `veio ${semResultado.dados?.processos?.length}`);

    // ─── Atualizar ──────────────────────────────────────────────
    const atualizado = await req('PUT', `/processos/${id}`, dono.token, { vara: '5ª Vara Cível' });
    t.status('PUT /processos/:id → 200', atualizado, 200);
    t.checar('a alteração persiste', atualizado.dados?.vara === '5ª Vara Cível',
      `veio ${atualizado.dados?.vara}`);

    // ─── Prazos do processo ─────────────────────────────────────
    const prazo = await req('POST', `/processos/${id}/prazos`, dono.token, {
      titulo: 'Contestação',
      dataVencimento: new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10),
      tipo: 'PROCESSUAL',
    });
    t.status('POST /processos/:id/prazos → 201', prazo, 201);

    const prazos = await req('GET', `/processos/${id}/prazos`, dono.token);
    t.checar('o prazo aparece na listagem', prazos.dados?.some((p) => p.id === prazo.dados?.id));

    const prazoRemovido = await req('DELETE', `/processos/${id}/prazos/${prazo.dados.id}`, dono.token);
    t.status('DELETE do prazo → 200', prazoRemovido, 200);

    // ─── Arquivados ─────────────────────────────────────────────
    await req('PUT', `/processos/${id}`, dono.token, { status: 'ARQUIVADO' });

    const semArquivados = await req('GET', '/processos', dono.token);
    t.checar('arquivado some da lista padrão',
      !semArquivados.dados.processos.some((p) => p.id === id));

    const comArquivados = await req('GET', '/processos?incluirArquivados=true', dono.token);
    t.checar('arquivado volta com incluirArquivados=true',
      comArquivados.dados.processos.some((p) => p.id === id));

    // ─── Excluir ────────────────────────────────────────────────
    const excluido = await req('DELETE', `/processos/${id}`, dono.token);
    t.status('DELETE /processos/:id → 200', excluido, 200);

    const sumiu = await req('GET', `/processos/${id}`, dono.token);
    t.status('processo excluído não existe mais → 404', sumiu, 404);
  },
};
