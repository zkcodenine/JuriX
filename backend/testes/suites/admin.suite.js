// ══════════════════════════════════════════════════════════════════
//  Administração — unidades, usuários e perfis.
//
//  Esconder o botão no frontend não é permissão, é decoração: todas
//  as checagens precisam estar no backend. Este teste bate na API com
//  um usuário comum para provar isso.
// ══════════════════════════════════════════════════════════════════
'use strict';

module.exports = {
  nome: 'Administração',
  precisaDeBanco: true,

  async executar({ t, req, fabrica, prisma, marca }) {
    const comum = await fabrica.usuario('admin_comum');
    const admin = await fabrica.usuario('admin_global', { perfil: 'ADMIN_GLOBAL' });
    const unidade = await fabrica.unidade('escritorio');
    const chefe = await fabrica.usuario('admin_unidade', {
      perfil: 'ADMIN_UNIDADE', unidadeId: unidade.id,
    });

    // ─── Contexto ───────────────────────────────────────────────
    const contexto = await req('GET', '/admin/contexto', admin.token);
    t.status('GET /admin/contexto → 200', contexto, 200);
    t.checar('o admin é reconhecido como global', contexto.dados?.ehAdminGlobal === true);

    const contextoComum = await req('GET', '/admin/contexto', comum.token);
    t.checar('usuário comum NÃO é admin global', contextoComum.dados?.ehAdminGlobal === false);

    // ─── Usuário comum é barrado em tudo ────────────────────────
    const barrados = [
      ['listar usuários',  'GET',    '/admin/usuarios',               null],
      ['criar unidade',    'POST',   '/admin/unidades',               { nome: 'Pirata' }],
      ['excluir unidade',  'DELETE', `/admin/unidades/${unidade.id}`, null],
      ['resetar senha',    'POST',   `/admin/usuarios/${admin.id}/resetar-senha`, { novaSenha: 'SenhaNova123' }],
    ];
    for (const [descricao, metodo, caminho, corpo] of barrados) {
      const r = await req(metodo, caminho, comum.token, corpo);
      t.status(`usuário comum: ${descricao} → 403`, r, 403);
    }

    // ─── Unidades ───────────────────────────────────────────────
    const criada = await req('POST', '/admin/unidades', admin.token, {
      nome: `${marca}_Nova Unidade`, cnpj: '12345678000190',
    });
    t.status('admin cria unidade → 201', criada, 201);
    fabrica.criados.unidades.push(criada.dados.id);

    const semNome = await req('POST', '/admin/unidades', admin.token, { nome: '  ' });
    t.status('unidade sem nome → 400', semNome, 400);

    const listadas = await req('GET', '/admin/unidades', admin.token);
    t.status('admin lista unidades → 200', listadas, 200);
    t.checar('a lista traz a contagem de usuários de cada unidade',
      typeof listadas.dados?.[0]?._count?.usuarios === 'number');

    // ADMIN_UNIDADE vê só a dele.
    const listaChefe = await req('GET', '/admin/unidades', chefe.token);
    t.checar('ADMIN_UNIDADE vê apenas a própria unidade',
      listaChefe.dados?.length === 1 && listaChefe.dados[0].id === unidade.id,
      `vieram ${listaChefe.dados?.length}`);

    // E só edita a dele.
    const editaPropria = await req('PUT', `/admin/unidades/${unidade.id}`, chefe.token, {
      telefone: '3133334444',
    });
    t.status('ADMIN_UNIDADE edita a própria unidade → 200', editaPropria, 200);

    const editaAlheia = await req('PUT', `/admin/unidades/${criada.dados.id}`, chefe.token, {
      nome: 'Tomada',
    });
    t.status('ADMIN_UNIDADE não edita unidade alheia → 403', editaAlheia, 403);

    // Unidade com usuário vinculado não pode sumir e levar o vínculo junto.
    const comUsuarios = await req('DELETE', `/admin/unidades/${unidade.id}`, admin.token);
    t.status('excluir unidade com usuários → 409', comUsuarios, 409);

    // ─── Usuários ───────────────────────────────────────────────
    const usuarios = await req('GET', '/admin/usuarios', admin.token);
    t.status('admin lista usuários → 200', usuarios, 200);
    t.checar('a listagem NUNCA traz o campo senha',
      !JSON.stringify(usuarios.dados).includes('"senha"'));

    const busca = await req('GET', `/admin/usuarios?busca=${encodeURIComponent(comum.email)}`, admin.token);
    t.checar('busca por e-mail encontra o usuário',
      busca.dados?.some((u) => u.id === comum.id));

    const promovido = await req('PUT', `/admin/usuarios/${comum.id}`, admin.token, {
      perfil: 'ADMIN_UNIDADE', unidadeId: unidade.id,
    });
    t.status('admin troca o perfil de um usuário → 200', promovido, 200);
    t.checar('o perfil novo é devolvido', promovido.dados?.perfil === 'ADMIN_UNIDADE');

    const cpfInvalido = await req('PUT', `/admin/usuarios/${comum.id}`, admin.token, { cpf: '123' });
    t.status('CPF com menos de 11 dígitos → 400', cpfInvalido, 400);

    const cpfOk = await req('PUT', `/admin/usuarios/${comum.id}`, admin.token, {
      cpf: '529.982.247-25',
    });
    t.status('CPF com máscara é aceito → 200', cpfOk, 200);
    const salvo = await prisma.usuario.findUnique({ where: { id: comum.id }, select: { cpf: true } });
    t.checar('o CPF é guardado só com dígitos (para o login por CPF achar)',
      salvo?.cpf === '52998224725', `veio ${salvo?.cpf}`);

    // ─── Reset de senha ─────────────────────────────────────────
    const curta = await req('POST', `/admin/usuarios/${comum.id}/resetar-senha`, admin.token, {
      novaSenha: '123',
    });
    t.status('senha com menos de 8 caracteres → 400', curta, 400);

    const resetada = await req('POST', `/admin/usuarios/${comum.id}/resetar-senha`, admin.token, {
      novaSenha: 'SenhaRedefinida123',
    });
    t.status('admin redefine a senha → 200', resetada, 200);

    const hash = await prisma.usuario.findUnique({ where: { id: comum.id }, select: { senha: true } });
    t.checar('a senha redefinida fica em bcrypt, nunca em texto puro',
      /^\$2[aby]\$\d{2}\$/.test(hash.senha), `começa com ${String(hash.senha).slice(0, 7)}`);

    const loginNovo = await req('POST', '/auth/login', null, {
      email: comum.email, senha: 'SenhaRedefinida123',
    });
    t.status('o usuário consegue entrar com a senha nova → 200', loginNovo, 200);

    const loginAntigo = await req('POST', '/auth/login', null, {
      email: comum.email, senha: comum.senha,
    });
    t.status('a senha antiga deixa de funcionar → 401', loginAntigo, 401);

    // ─── Nunca ficar sem administrador ──────────────────────────
    // Só vale quando o admin de teste é o último ativo do sistema.
    const outrosAdmins = await prisma.usuario.count({
      where: { perfil: 'ADMIN_GLOBAL', ativo: true, NOT: { id: admin.id } },
    });
    if (outrosAdmins === 0) {
      const rebaixar = await req('PUT', `/admin/usuarios/${admin.id}`, admin.token, {
        perfil: 'USUARIO',
      });
      t.status('rebaixar o último administrador → 409', rebaixar, 409);
    } else {
      t.pular('rebaixar o último administrador', `existem ${outrosAdmins} outros admins neste banco`);
    }
  },
};
