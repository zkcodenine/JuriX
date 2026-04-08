const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { prisma } = require('../config/database');
const { cacheDel } = require('../config/redis');

// ── Multer para avatar ──────────────────────────────
const avatarStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(process.env.STORAGE_PATH || './storage', 'avatars');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, _file, cb) => {
    cb(null, `${req.usuario.id}.jpg`);
  },
});
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Apenas imagens são permitidas.'));
  },
}).single('avatar');

function gerarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, email: usuario.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /api/auth/registrar
async function registrar(req, res, next) {
  try {
    const { nome, email, senha, oab, telefone, aceitouTermos } = req.body;

    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe) {
      return res.status(409).json({ error: 'E-mail já cadastrado.' });
    }

    const hash = await bcrypt.hash(senha, 12);

    const usuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        senha: hash,
        oab: oab || null,
        telefone: telefone || null,
        aceitouTermos: true,
      },
      select: { id: true, nome: true, email: true, oab: true, plano: true, criadoEm: true },
    });

    const token = gerarToken(usuario);

    res.status(201).json({ token, usuario });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, senha } = req.body;

    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const senhaOk = await bcrypt.compare(senha, usuario.senha);
    if (!senhaOk) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    if (!usuario.ativo) {
      return res.status(403).json({ error: 'Conta desativada.' });
    }

    const token = gerarToken(usuario);

    const { senha: _, ...usuarioSemSenha } = usuario;
    res.json({ token, usuario: usuarioSemSenha });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me
async function me(req, res, next) {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario.id },
      select: {
        id: true, nome: true, email: true, oab: true,
        telefone: true, avatar: true, tema: true,
        plano: true, planoExpiracao: true, criadoEm: true,
      },
    });
    res.json(usuario);
  } catch (err) {
    next(err);
  }
}

// PUT /api/auth/perfil
async function atualizarPerfil(req, res, next) {
  try {
    const { nome, oab, telefone, tema } = req.body;

    const data = {};
    if (nome !== undefined) data.nome = nome;
    if (oab !== undefined) data.oab = oab || null;
    if (telefone !== undefined) data.telefone = telefone || null;
    if (tema !== undefined && ['ESCURO', 'CLARO'].includes(tema)) data.tema = tema;

    const usuario = await prisma.usuario.update({
      where: { id: req.usuario.id },
      data,
      select: { id: true, nome: true, email: true, oab: true, telefone: true, avatar: true, tema: true },
    });

    await cacheDel(`user:${req.usuario.id}`);
    res.json(usuario);
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/avatar
async function uploadAvatarHandler(req, res, next) {
  uploadAvatar(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

    const avatarUrl = `/storage/avatars/${req.usuario.id}.jpg`;

    const usuario = await prisma.usuario.update({
      where: { id: req.usuario.id },
      data: { avatar: avatarUrl },
      select: { id: true, avatar: true },
    });

    await cacheDel(`user:${req.usuario.id}`);
    res.json({ avatar: usuario.avatar });
  });
}

// POST /api/auth/alterar-senha
async function alterarSenha(req, res, next) {
  try {
    const { senhaAtual, novaSenha } = req.body;

    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
    const senhaOk = await bcrypt.compare(senhaAtual, usuario.senha);
    if (!senhaOk) {
      return res.status(400).json({ error: 'Senha atual incorreta.' });
    }

    const hash = await bcrypt.hash(novaSenha, 12);
    await prisma.usuario.update({ where: { id: req.usuario.id }, data: { senha: hash } });

    await cacheDel(`user:${req.usuario.id}`);
    res.json({ mensagem: 'Senha alterada com sucesso.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/dev-activate — ativa plano VITALICIO com código secreto
async function devActivate(req, res, next) {
  try {
    const { codigo } = req.body;
    const codigoValido = process.env.DEV_ACTIVATE_CODE || 'JURIX-DEV-VITALICIO-2026';
    if (!codigo || codigo !== codigoValido) {
      return res.status(403).json({ error: 'Código inválido.' });
    }
    const usuario = await prisma.usuario.update({
      where: { id: req.usuario.id },
      data: { plano: 'VITALICIO', planoExpiracao: null },
      select: { id: true, nome: true, email: true, plano: true, tema: true, oab: true, telefone: true, avatar: true },
    });
    await cacheDel(`user:${req.usuario.id}`);
    res.json({ mensagem: 'Plano vitalício ativado com sucesso!', usuario });
  } catch (err) { next(err); }
}

module.exports = { registrar, login, me, atualizarPerfil, alterarSenha, uploadAvatarHandler, devActivate };
