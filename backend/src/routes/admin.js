const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { body, param } = require('express-validator');
const auth = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const auditLog = require('../middlewares/audit');
const { prisma } = require('../config/database');
const { cacheDel } = require('../config/redis');
const { requerAdminGlobal, podeEditarUnidade, ehAdminGlobal } = require('../middlewares/requerAdmin');

router.use(auth);

const PERFIS = ['USUARIO', 'ADMIN_UNIDADE', 'ADMIN_GLOBAL'];
const soDigitos = (v) => String(v || '').replace(/\D/g, '');

// Campos do usuário que o admin pode ver. Nunca inclui `senha`.
const CAMPOS_USUARIO = {
  id: true, nome: true, email: true, cpf: true, oab: true, telefone: true,
  perfil: true, plano: true, ativo: true, ultimoLogin: true, criadoEm: true,
  unidade: { select: { id: true, nome: true } },
};

// ─── Quem sou eu (para o frontend decidir o que mostrar) ──
router.get('/contexto', (req, res) => {
  res.json({
    perfil: req.usuario.perfil,
    unidadeId: req.usuario.unidadeId,
    ehAdminGlobal: ehAdminGlobal(req.usuario),
  });
});

// ══════════════════════════════════════════════════
//  UNIDADES
// ══════════════════════════════════════════════════

// Listar. ADMIN_GLOBAL vê todas; ADMIN_UNIDADE vê só a dele.
router.get('/unidades', async (req, res, next) => {
  try {
    const where = ehAdminGlobal(req.usuario)
      ? {}
      : { id: req.usuario.unidadeId || '__nenhuma__' };

    const unidades = await prisma.unidade.findMany({
      where,
      orderBy: { nome: 'asc' },
      include: { _count: { select: { usuarios: true } } },
    });
    res.json(unidades);
  } catch (err) { next(err); }
});

router.post('/unidades', requerAdminGlobal, [
  body('nome').trim().notEmpty().withMessage('Nome da unidade é obrigatório'),
  validate,
], auditLog('CRIAR', 'UNIDADE'), async (req, res, next) => {
  try {
    const { nome, cnpj, endereco, telefone, email, observacoes } = req.body;
    const unidade = await prisma.unidade.create({
      data: {
        nome: nome.trim(),
        cnpj: cnpj || null,
        endereco: endereco || null,
        telefone: telefone || null,
        email: email || null,
        observacoes: observacoes || null,
      },
    });
    res.status(201).json(unidade);
  } catch (err) { next(err); }
});

// Editar. Aqui entra a regra que o usuário pediu: quem não é admin da unidade
// não consegue editar as informações dela.
router.put('/unidades/:id', [
  param('id').isUUID(),
  body('nome').optional().trim().notEmpty().withMessage('Nome não pode ficar vazio'),
  validate,
], auditLog('ATUALIZAR', 'UNIDADE'), async (req, res, next) => {
  try {
    if (!podeEditarUnidade(req.usuario, req.params.id)) {
      return res.status(403).json({ error: 'Você não administra esta unidade.' });
    }

    const dados = {};
    for (const campo of ['nome', 'cnpj', 'endereco', 'telefone', 'email', 'observacoes']) {
      if (req.body[campo] !== undefined) {
        dados[campo] = campo === 'nome' ? req.body[campo].trim() : (req.body[campo] || null);
      }
    }
    if (req.body.ativo !== undefined && ehAdminGlobal(req.usuario)) {
      dados.ativo = Boolean(req.body.ativo);
    }

    const unidade = await prisma.unidade.update({ where: { id: req.params.id }, data: dados });
    res.json(unidade);
  } catch (err) { next(err); }
});

router.delete('/unidades/:id', requerAdminGlobal, [
  param('id').isUUID(), validate,
], auditLog('DELETAR', 'UNIDADE'), async (req, res, next) => {
  try {
    const vinculados = await prisma.usuario.count({ where: { unidadeId: req.params.id } });
    if (vinculados > 0) {
      return res.status(409).json({
        error: `Esta unidade tem ${vinculados} usuário(s) vinculado(s). Desvincule-os antes de excluir.`,
      });
    }
    await prisma.unidade.delete({ where: { id: req.params.id } });
    res.json({ mensagem: 'Unidade excluída.' });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════
//  USUÁRIOS
// ══════════════════════════════════════════════════

router.get('/usuarios', requerAdminGlobal, async (req, res, next) => {
  try {
    const { unidadeId, busca } = req.query;
    const where = {};
    if (unidadeId === 'sem') where.unidadeId = null;
    else if (unidadeId) where.unidadeId = unidadeId;
    if (busca) {
      where.OR = [
        { nome: { contains: busca } },
        { email: { contains: busca } },
        { cpf: { contains: soDigitos(busca) || busca } },
      ];
    }
    const usuarios = await prisma.usuario.findMany({
      where,
      select: CAMPOS_USUARIO,
      orderBy: { nome: 'asc' },
    });
    res.json(usuarios);
  } catch (err) { next(err); }
});

// Editar: nome, CPF, contato, perfil e unidade.
router.put('/usuarios/:id', requerAdminGlobal, [
  param('id').isUUID(),
  body('nome').optional().trim().notEmpty(),
  body('perfil').optional().isIn(PERFIS).withMessage('Perfil inválido'),
  validate,
], auditLog('ATUALIZAR', 'USUARIO'), async (req, res, next) => {
  try {
    const alvo = await prisma.usuario.findUnique({ where: { id: req.params.id } });
    if (!alvo) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const dados = {};
    if (req.body.nome !== undefined) dados.nome = req.body.nome.trim();
    if (req.body.oab !== undefined) dados.oab = req.body.oab || null;
    if (req.body.telefone !== undefined) dados.telefone = req.body.telefone || null;
    if (req.body.perfil !== undefined) dados.perfil = req.body.perfil;
    if (req.body.ativo !== undefined) dados.ativo = Boolean(req.body.ativo);

    // CPF: guardamos só dígitos, para o login por CPF achar independente da
    // máscara que o usuário digitar.
    if (req.body.cpf !== undefined) {
      const cpf = soDigitos(req.body.cpf);
      if (cpf && cpf.length !== 11) {
        return res.status(400).json({ error: 'CPF deve ter 11 dígitos.' });
      }
      if (cpf) {
        const jaTem = await prisma.usuario.findFirst({
          where: { cpf, NOT: { id: req.params.id } },
          select: { nome: true },
        });
        if (jaTem) return res.status(409).json({ error: `Este CPF já está em uso por ${jaTem.nome}.` });
      }
      dados.cpf = cpf || null;
    }

    if (req.body.unidadeId !== undefined) {
      dados.unidadeId = req.body.unidadeId || null;
    }

    // ADMIN_GLOBAL fica acima de todas as unidades — sem vínculo.
    if (dados.perfil === 'ADMIN_GLOBAL') dados.unidadeId = null;

    // Não deixar o sistema ficar sem nenhum administrador.
    if (alvo.perfil === 'ADMIN_GLOBAL' && dados.perfil && dados.perfil !== 'ADMIN_GLOBAL') {
      const outros = await prisma.usuario.count({
        where: { perfil: 'ADMIN_GLOBAL', ativo: true, NOT: { id: alvo.id } },
      });
      if (outros === 0) {
        return res.status(409).json({ error: 'Este é o último administrador. Promova outro antes de rebaixá-lo.' });
      }
    }

    const usuario = await prisma.usuario.update({
      where: { id: req.params.id },
      data: dados,
      select: CAMPOS_USUARIO,
    });

    // O middleware auth cacheia o usuário por 5 min — sem isto, o perfil novo
    // só valeria depois do cache expirar.
    await cacheDel(`user:v2:${req.params.id}`);
    res.json(usuario);
  } catch (err) { next(err); }
});

// Resetar senha: o admin define a nova senha (decisão registrada no plano).
router.post('/usuarios/:id/resetar-senha', requerAdminGlobal, [
  param('id').isUUID(),
  body('novaSenha').isLength({ min: 8 }).withMessage('A senha deve ter no mínimo 8 caracteres'),
  validate,
], auditLog('RESETAR_SENHA', 'USUARIO'), async (req, res, next) => {
  try {
    const alvo = await prisma.usuario.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!alvo) return res.status(404).json({ error: 'Usuário não encontrado.' });

    // Sempre com hash. Gravar senha em texto puro na tabela é o que trancou
    // todos os usuários para fora em 16/jul.
    const hash = await bcrypt.hash(req.body.novaSenha, 12);
    await prisma.usuario.update({ where: { id: req.params.id }, data: { senha: hash } });

    await cacheDel(`user:v2:${req.params.id}`);
    res.json({ mensagem: 'Senha redefinida com sucesso.' });
  } catch (err) { next(err); }
});

module.exports = router;
