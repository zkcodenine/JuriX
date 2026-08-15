// Tipos de prazo personalizados do usuário (CRUD).
const router = require('express').Router();
const auth = require('../middlewares/auth');
const { prisma } = require('../config/database');

router.use(auth);

// Listar
router.get('/', async (req, res, next) => {
  try {
    const tipos = await prisma.tipoPrazoUsuario.findMany({
      where: { usuarioId: req.usuario.id },
      orderBy: { nome: 'asc' },
    });
    res.json(tipos);
  } catch (err) { next(err); }
});

// Criar
router.post('/', async (req, res, next) => {
  try {
    const nome = String(req.body.nome || '').trim();
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório.' });
    const existe = await prisma.tipoPrazoUsuario.findFirst({
      where: { usuarioId: req.usuario.id, nome },
    });
    if (existe) return res.status(409).json({ error: 'Este tipo já existe.' });
    const tipo = await prisma.tipoPrazoUsuario.create({
      data: { usuarioId: req.usuario.id, nome },
    });
    res.status(201).json(tipo);
  } catch (err) { next(err); }
});

// Editar
router.put('/:id', async (req, res, next) => {
  try {
    const nome = String(req.body.nome || '').trim();
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório.' });
    const existe = await prisma.tipoPrazoUsuario.findFirst({
      where: { id: req.params.id, usuarioId: req.usuario.id },
    });
    if (!existe) return res.status(404).json({ error: 'Tipo não encontrado.' });
    const tipo = await prisma.tipoPrazoUsuario.update({
      where: { id: req.params.id },
      data: { nome },
    });
    res.json(tipo);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Já existe um tipo com esse nome.' });
    next(err);
  }
});

// Excluir
router.delete('/:id', async (req, res, next) => {
  try {
    const existe = await prisma.tipoPrazoUsuario.findFirst({
      where: { id: req.params.id, usuarioId: req.usuario.id },
    });
    if (!existe) return res.status(404).json({ error: 'Tipo não encontrado.' });
    await prisma.tipoPrazoUsuario.delete({ where: { id: req.params.id } });
    res.json({ mensagem: 'Tipo removido.' });
  } catch (err) { next(err); }
});

module.exports = router;
