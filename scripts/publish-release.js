// ══════════════════════════════════════════════════════════════════
//  JuriX — Publicar release no GitHub (feed do auto-update)
//
//  Sobe o instalador já buildado (dist-electron) como release "latest"
//  no GitHub, para que TODOS os apps instalados atualizem sozinhos.
//
//  Uso (após buildar):  node scripts/publish-release.js
//  Ou tudo de uma vez:  npm run release
//
//  Requer o GitHub CLI (gh) autenticado: https://cli.github.com/
// ══════════════════════════════════════════════════════════════════
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const version = pkg.version;
const repo = `${pkg.build.publish.owner}/${pkg.build.publish.repo}`;
const dist = path.join(root, 'dist-electron');

const assets = [
  path.join(dist, `JuriX-Setup-${version}.exe`),
  path.join(dist, `JuriX-Setup-${version}.exe.blockmap`),
  path.join(dist, 'latest.yml'),
];

// Verifica se o build existe.
for (const a of assets) {
  if (!fs.existsSync(a)) {
    console.error(`\n[!] Arquivo não encontrado: ${a}`);
    console.error('    Rode o build antes: npm run build\n');
    process.exit(1);
  }
}

// Confere se a release já existe (evita duplicar).
try {
  execFileSync('gh', ['release', 'view', `v${version}`, '--repo', repo], { stdio: 'ignore' });
  console.error(`\n[!] A release v${version} já existe no GitHub.`);
  console.error('    Suba a versão em package.json antes de publicar de novo.\n');
  process.exit(1);
} catch { /* não existe — ok, vamos criar */ }

const notes = `## JuriX v${version}\n\nAtualização automática obrigatória. Nenhuma ação é necessária — o app se atualiza sozinho.`;

console.log(`→ Publicando release v${version} em ${repo}...`);
execFileSync('gh', [
  'release', 'create', `v${version}`,
  ...assets,
  '--repo', repo,
  '--title', `JuriX v${version}`,
  '--notes', notes,
  '--latest',
  '--target', 'main',
], { stdio: 'inherit' });

console.log(`\n✓ Release v${version} publicada. Os apps instalados vão atualizar automaticamente.`);
