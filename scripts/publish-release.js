// ══════════════════════════════════════════════════════════════════
//  JuriX — Publicar release no GitHub (feed do auto-update)
//
//  Sobe o instalador já buildado (dist-electron) como release "latest"
//  no GitHub, para que TODOS os apps instalados atualizem sozinhos.
//
//  NÃO depende mais do GitHub CLI (gh). Usa a API do GitHub com um token:
//    - Defina GH_TOKEN (ou GITHUB_TOKEN) com um Personal Access Token que
//      tenha permissão de "Contents: read/write" no repositório.
//
//  Uso (após buildar):
//    Windows (PowerShell):  $env:GH_TOKEN="seu_token"; npm run publish-release
//    Tudo de uma vez:       $env:GH_TOKEN="seu_token"; npm run release
// ══════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const version = pkg.version;
const owner = pkg.build.publish.owner;
const repo = pkg.build.publish.repo;
const dist = path.join(root, 'dist-electron');

const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const API = 'https://api.github.com';
const UPLOADS = 'https://uploads.github.com';
const UA = 'JuriX-Publisher';

const assets = [
  { file: path.join(dist, `JuriX-Setup-${version}.exe`), type: 'application/octet-stream' },
  { file: path.join(dist, `JuriX-Setup-${version}.exe.blockmap`), type: 'application/octet-stream' },
  { file: path.join(dist, 'latest.yml'), type: 'text/yaml' },
];

function morrer(msg) { console.error(`\n[!] ${msg}\n`); process.exit(1); }

// No Windows o gh geralmente é gh.exe; sem shell:true evitamos que o cmd
// reinterprete aspas/globs/quebras de linha dos argumentos (foi o que gerou
// o erro "no matches found"). Tentamos 'gh' e, se não achar, 'gh.exe'.
function chamarGh(args, opts = {}) {
  let r = spawnSync('gh', args, { ...opts });
  if (r.error && r.error.code === 'ENOENT' && process.platform === 'win32') {
    r = spawnSync('gh.exe', args, { ...opts });
  }
  return r;
}

// gh instalado E autenticado? (login pelo navegador, sem token à vista)
function ghPronto() {
  const r = chamarGh(['auth', 'status'], { stdio: 'ignore' });
  return !r.error && r.status === 0;
}

// Publica via GitHub CLI — usa a credencial já guardada pelo `gh auth login`.
function publicarComGh(arquivos) {
  // As notas vão por ARQUIVO — evita qualquer problema de quebra de linha/aspas
  // na linha de comando.
  const os = require('os');
  const notesFile = path.join(os.tmpdir(), `jurix-notes-${version}.md`);
  fs.writeFileSync(notesFile,
    `## JuriX v${version}\n\nAtualização automática. Nenhuma ação é necessária — o app se atualiza sozinho.\n`);

  // A tag já existe? Evita erro duplicado.
  const existe = chamarGh(['release', 'view', `v${version}`, '--repo', `${owner}/${repo}`], { stdio: 'ignore' });
  if (!existe.error && existe.status === 0) {
    try { fs.unlinkSync(notesFile); } catch {}
    morrer(`A release v${version} já existe. Suba a versão em package.json antes.`);
  }

  console.log(`→ Publicando release v${version} em ${owner}/${repo} (via gh)...`);
  const r = chamarGh([
    'release', 'create', `v${version}`,
    ...arquivos,
    '--repo', `${owner}/${repo}`,
    '--title', `JuriX v${version}`,
    '--notes-file', notesFile,
    '--latest',
    '--target', 'main',
  ], { stdio: 'inherit' });

  try { fs.unlinkSync(notesFile); } catch {}

  if (r.error || r.status !== 0) {
    morrer('Falha ao publicar via gh. Verifique `gh auth status` e tente novamente.');
  }
  console.log(`\n✓ Release v${version} publicada. Os apps instalados vão atualizar automaticamente.`);
  process.exit(0);
}

async function gh(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': UA,
      ...(opts.headers || {}),
    },
  });
  return res;
}

(async () => {
  // Verifica se os arquivos do build existem (vale para os dois caminhos).
  for (const a of assets) {
    if (!fs.existsSync(a.file)) {
      morrer(`Arquivo não encontrado: ${a.file}\n    Rode o build antes:  npm run build`);
    }
  }

  // Caminho preferido: GitHub CLI autenticado (sem token à vista).
  if (ghPronto()) {
    publicarComGh(assets.map((a) => a.file)); // sai do processo ao terminar
    return;
  }

  // Fallback: token via API.
  if (!TOKEN) {
    morrer('Nenhuma credencial encontrada. Escolha um:\n' +
           '    A) gh (recomendado, sem token):  gh auth login   e rode de novo\n' +
           '    B) token:  $env:GH_TOKEN="ghp_xxx"; npm run publish-release  (PowerShell)\n' +
           '       (o token precisa de "Contents: read and write" no repositório)');
  }

  // Já existe release com esta tag?
  const existente = await gh(`${API}/repos/${owner}/${repo}/releases/tags/v${version}`);
  if (existente.status === 200) {
    morrer(`A release v${version} já existe no GitHub.\n    Suba a versão em package.json antes de publicar de novo.`);
  }
  if (existente.status === 401) morrer('Token inválido ou sem permissão (401).');

  // Cria a release.
  console.log(`→ Criando release v${version} em ${owner}/${repo}...`);
  const criar = await gh(`${API}/repos/${owner}/${repo}/releases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tag_name: `v${version}`,
      target_commitish: 'main',
      name: `JuriX v${version}`,
      body: `## JuriX v${version}\n\nAtualização automática. Nenhuma ação é necessária — o app se atualiza sozinho.`,
      draft: false,
      prerelease: false,
      make_latest: 'true',
    }),
  });
  if (criar.status !== 201) {
    morrer(`Falha ao criar a release (${criar.status}): ${await criar.text()}`);
  }
  const release = await criar.json();
  console.log(`  release #${release.id} criada.`);

  // Sobe cada asset.
  for (const a of assets) {
    const nome = path.basename(a.file);
    const dados = fs.readFileSync(a.file);
    process.stdout.write(`→ Enviando ${nome} (${(dados.length / 1e6).toFixed(1)} MB)... `);
    const up = await gh(`${UPLOADS}/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(nome)}`, {
      method: 'POST',
      headers: { 'Content-Type': a.type, 'Content-Length': String(dados.length) },
      body: dados,
    });
    if (up.status !== 201) {
      morrer(`Falha ao enviar ${nome} (${up.status}): ${await up.text()}`);
    }
    console.log('ok');
  }

  console.log(`\n✓ Release v${version} publicada. Os apps instalados vão atualizar automaticamente.`);
})().catch((e) => morrer(e.message));
