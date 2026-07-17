// Checagens de perfil. Rodam SEMPRE no backend — esconder o botão no frontend
// não é permissão, é decoração.
//
// Limite conhecido: enquanto o backend roda na máquina do cliente e o .env com
// a senha do MySQL vai dentro do instalador, qualquer usuário pode editar a
// tabela direto e contornar isto. Vira segurança de verdade quando o backend
// for para um servidor (ver PLANO-MULTIUSUARIO.md, Fase 0).

function ehAdminGlobal(usuario) {
  return usuario?.perfil === 'ADMIN_GLOBAL';
}

// Só ADMIN_GLOBAL: gerencia unidades e usuários de todo o sistema.
function requerAdminGlobal(req, res, next) {
  if (!ehAdminGlobal(req.usuario)) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  next();
}

// Quem pode editar os dados de uma unidade: o ADMIN_GLOBAL (que está acima de
// todas) ou o ADMIN_UNIDADE **daquela** unidade. Um ADMIN_UNIDADE não mexe em
// escritório alheio.
function podeEditarUnidade(usuario, unidadeId) {
  if (ehAdminGlobal(usuario)) return true;
  return usuario?.perfil === 'ADMIN_UNIDADE' && usuario?.unidadeId === unidadeId;
}

module.exports = { requerAdminGlobal, podeEditarUnidade, ehAdminGlobal };
