// ══════════════════════════════════════════════════════════════════
//  Tarefas — CRUD, subtarefas e vínculo com processo.
//
//  O vínculo importa porque o seletor de processo da tela de tarefa
//  manda só o id: se o backend parar de aceitar `processoId`, a tarefa
//  é criada solta e o advogado não acha mais o prazo pelo processo.
// ══════════════════════════════════════════════════════════════════
'use strict';

const amanha = () => new Date(Date.now() + 864e5).toISOString().slice(0, 10);

module.exports = {
  nome: 'Tarefas',
  precisaDeBanco: true,

  async executar({ t, req, fabrica, marca }) {
    const dono = await fabrica.usuario('tar_dono');
    const proc = await fabrica.processo(dono.token, { numero: `${marca}-TAR` });

    // ─── Criar ──────────────────────────────────────────────────
    const criada = await req('POST', '/tarefas', dono.token, {
      titulo: 'Protocolar contestação',
      prazo: amanha(),
      horario: '09:30',
      prioridade: 'ALTA',
      processoId: proc.dados.id,
      subtarefas: [{ titulo: 'Reunir documentos' }, { titulo: 'Revisar texto' }],
    });
    t.status('POST /tarefas → 201', criada, 201);

    const id = criada.dados?.id;
    t.checar('tarefa nasce vinculada ao processo', criada.dados?.processoId === proc.dados.id,
      `veio ${criada.dados?.processoId}`);
    t.checar('as 2 subtarefas são criadas junto', criada.dados?.subtarefas?.length === 2,
      `vieram ${criada.dados?.subtarefas?.length}`);
    t.checar('googleSync vem ligado por padrão', criada.dados?.googleSync === true,
      `veio ${criada.dados?.googleSync}`);

    // ─── Campo desconhecido não derruba a criação ───────────────
    // A rota usa whitelist justamente para isso: um campo novo no
    // frontend não pode virar PrismaClientValidationError 500.
    const comCampoExtra = await req('POST', '/tarefas', dono.token, {
      titulo: 'Tarefa com campo novo',
      campoQueNaoExiste: 'xyz',
    });
    t.status('campo desconhecido é ignorado, não quebra → 201', comCampoExtra, 201);

    // ─── Listar e filtrar ───────────────────────────────────────
    const lista = await req('GET', '/tarefas', dono.token);
    t.status('GET /tarefas → 200', lista, 200);
    t.checar('a tarefa aparece na lista', lista.dados?.some((x) => x.id === id));
    t.checar('a lista traz o processo embutido (para mostrar o cliente)',
      lista.dados?.find((x) => x.id === id)?.processo?.id === proc.dados.id);

    const porProcesso = await req('GET', `/tarefas?processoId=${proc.dados.id}`, dono.token);
    t.checar('filtro por processoId funciona',
      porProcesso.dados?.length >= 1 && porProcesso.dados.every((x) => x.processoId === proc.dados.id));

    const porStatus = await req('GET', '/tarefas?status=CONCLUIDA', dono.token);
    t.checar('filtro por status funciona',
      Array.isArray(porStatus.dados) && porStatus.dados.every((x) => x.status === 'CONCLUIDA'));

    // ─── Atualizar ──────────────────────────────────────────────
    const atualizada = await req('PUT', `/tarefas/${id}`, dono.token, { prioridade: 'URGENTE' });
    t.status('PUT /tarefas/:id → 200', atualizada, 200);
    t.checar('a prioridade muda', atualizada.dados?.prioridade === 'URGENTE');

    const desvinculada = await req('PUT', `/tarefas/${id}`, dono.token, { processoId: null });
    t.checar('dá para desvincular do processo', desvinculada.dados?.processoId === null,
      `veio ${desvinculada.dados?.processoId}`);

    const revinculada = await req('PUT', `/tarefas/${id}`, dono.token, { processoId: proc.dados.id });
    t.checar('e vincular de novo', revinculada.dados?.processoId === proc.dados.id);

    const concluida = await req('PUT', `/tarefas/${id}`, dono.token, { status: 'CONCLUIDA' });
    t.checar('concluir a tarefa funciona', concluida.dados?.status === 'CONCLUIDA');

    // ─── Subtarefas ─────────────────────────────────────────────
    const sub = await req('POST', `/tarefas/${id}/subtarefas`, dono.token, { titulo: 'Protocolar' });
    t.status('POST subtarefa → 201', sub, 201);

    const subEditada = await req('PUT', `/tarefas/${id}/subtarefas/${sub.dados.id}`, dono.token, {
      status: 'CONCLUIDA',
    });
    t.checar('subtarefa pode ser concluída', subEditada.dados?.status === 'CONCLUIDA');

    const subRemovida = await req('DELETE', `/tarefas/${id}/subtarefas/${sub.dados.id}`, dono.token);
    t.status('DELETE subtarefa → 200', subRemovida, 200);

    // ─── Tarefa de outro usuário ────────────────────────────────
    const intruso = await fabrica.usuario('tar_intruso');
    const espiar = await req('GET', '/tarefas', intruso.token);
    t.checar('tarefa não vaza para outro usuário',
      !espiar.dados?.some((x) => x.id === id));

    const editarAlheia = await req('PUT', `/tarefas/${id}`, intruso.token, { titulo: 'invadida' });
    t.status('editar tarefa alheia → 404', editarAlheia, 404);

    // ─── Excluir ────────────────────────────────────────────────
    const excluida = await req('DELETE', `/tarefas/${id}`, dono.token);
    t.status('DELETE /tarefas/:id → 200', excluida, 200);
  },
};
