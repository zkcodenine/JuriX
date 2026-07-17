// ══════════════════════════════════════════════════════════════════
//  Acesso a processo — ponto ÚNICO de decisão.
//
//  Antes, o isolamento era `usuarioId: req.usuario.id` copiado em dezenas de
//  lugares. Com o compartilhamento, "sou dono" virou "tenho acesso", e um erro
//  aqui vaza processo de um cliente para outro. Por isso a regra mora em um
//  lugar só, coberta por backend/testes/isolamento.test.js.
//
//  Enquanto nada estiver compartilhado, o OR com a tabela vazia devolve
//  exatamente o mesmo conjunto de antes — o comportamento atual é preservado.
//
//  Regras:
//    ver      → dono OU compartilhado (LEITURA ou EDICAO)
//    editar   → dono OU compartilhado com EDICAO
//    excluir  → só o dono
//    compartilhar/revogar → só o dono
// ══════════════════════════════════════════════════════════════════

// Fragmento `where` para Processo: tudo que o usuário PODE VER.
function whereProcessoVisivel(usuarioId) {
  return {
    OR: [
      { usuarioId },
      { compartilhamentos: { some: { usuarioId } } },
    ],
  };
}

// Fragmento `where` para Processo: tudo que o usuário PODE EDITAR.
function whereProcessoEditavel(usuarioId) {
  return {
    OR: [
      { usuarioId },
      { compartilhamentos: { some: { usuarioId, nivel: 'EDICAO' } } },
    ],
  };
}

// Para sub-recursos (documento, prazo, tarefa...), que filtram pelo processo:
//   where: { processoId: id, processo: processoVisivelPara(uid) }
const processoVisivelPara = whereProcessoVisivel;
const processoEditavelPor = whereProcessoEditavel;

// ─── Verificações imperativas ──────────────────────
//
// Devolvem { ok, status, erro } para o handler responder direto.
// A distinção entre 404 e 403 é deliberada:
//   404 = não tenho acesso nenhum; não revelo que o processo existe.
//   403 = eu vejo o processo, mas não posso fazer esta ação.
// Responder 403 para quem não tem acesso vazaria a existência do processo.

async function podeVer(prisma, processoId, usuarioId) {
  const p = await prisma.processo.findFirst({
    where: { id: processoId, ...whereProcessoVisivel(usuarioId) },
    select: { id: true, usuarioId: true },
  });
  if (!p) return { ok: false, status: 404, erro: 'Processo não encontrado.' };
  return { ok: true, processo: p };
}

async function podeEditar(prisma, processoId, usuarioId) {
  const visivel = await podeVer(prisma, processoId, usuarioId);
  if (!visivel.ok) return visivel;

  const editavel = await prisma.processo.findFirst({
    where: { id: processoId, ...whereProcessoEditavel(usuarioId) },
    select: { id: true },
  });
  if (!editavel) {
    return { ok: false, status: 403, erro: 'Este processo foi compartilhado com você apenas para leitura.' };
  }
  return { ok: true, processo: visivel.processo };
}

async function ehDono(prisma, processoId, usuarioId) {
  const visivel = await podeVer(prisma, processoId, usuarioId);
  if (!visivel.ok) return visivel;

  if (visivel.processo.usuarioId !== usuarioId) {
    return { ok: false, status: 403, erro: 'Apenas o dono do processo pode fazer isso.' };
  }
  return { ok: true, processo: visivel.processo };
}

module.exports = {
  whereProcessoVisivel,
  whereProcessoEditavel,
  processoVisivelPara,
  processoEditavelPor,
  podeVer,
  podeEditar,
  ehDono,
};
