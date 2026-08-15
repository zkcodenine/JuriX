// ══════════════════════════════════════════════════════════════════
//  Remove o fundo PRETO dos ícones do JuriX, deixando só o logo dourado
//  com fundo transparente (sem a "borda preta"). Regenera o .ico do app.
//
//  Usa flood-fill a partir das bordas: só o preto que rodeia a figura vira
//  transparente — detalhes escuros DENTRO do logo são preservados.
//  Idempotente e seguro (os originais estão versionados no git).
//
//  Uso:  node scripts/gerar-icones-transparentes.js
// ══════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico');

const RAIZ = path.join(__dirname, '..');

// Fonte de maior resolução disponível (o próprio icon.png, 1146px).
const FONTE = path.join(RAIZ, 'electron', 'assets', 'icon.png');

async function semFundo(src, outSize) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const ehFundo = (i) => data[i] < 46 && data[i + 1] < 46 && data[i + 2] < 46;

  const visitado = new Uint8Array(W * H);
  const pilha = [];
  for (let x = 0; x < W; x++) { pilha.push(x, x + (H - 1) * W); }
  for (let y = 0; y < H; y++) { pilha.push(y * W, y * W + (W - 1)); }

  while (pilha.length) {
    const p = pilha.pop();
    if (p < 0 || p >= W * H || visitado[p]) continue;
    const i = p * 4;
    if (!ehFundo(i)) continue;           // parou na figura dourada
    visitado[p] = 1; data[i + 3] = 0;    // transparente
    const x = p % W, y = (p / W) | 0;
    if (x + 1 < W) pilha.push(p + 1);
    if (x - 1 >= 0) pilha.push(p - 1);
    if (y + 1 < H) pilha.push(p + W);
    if (y - 1 >= 0) pilha.push(p - W);
  }

  return sharp(data, { raw: { width: W, height: H, channels: 4 } })
    .resize(outSize, outSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png();
}

(async () => {
  // 1) Ícone do app / bandeja / loading (PNG 512, transparente)
  await (await semFundo(FONTE, 512)).toFile(path.join(RAIZ, 'electron', 'assets', 'icon.png'));
  console.log('✓ electron/assets/icon.png');

  // 2) Ícone .ico do app e da barra de tarefas (multi-resolução) — regerado a
  //    partir de PNGs transparentes 256/128/64/48/32/16.
  const tmpDir = path.join(RAIZ, 'electron', 'assets', '_ico_tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const tamanhos = [256, 128, 64, 48, 32, 16];
  const arquivos = [];
  for (const s of tamanhos) {
    const fp = path.join(tmpDir, `i${s}.png`);
    await (await semFundo(FONTE, s)).toFile(fp);
    arquivos.push(fp);
  }
  const ico = await pngToIco(arquivos);
  fs.writeFileSync(path.join(RAIZ, 'electron', 'assets', 'icon.ico'), ico);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('✓ electron/assets/icon.ico');

  // 3) Logo do app (sidebar) e favicon (barra de título / aba)
  await (await semFundo(FONTE, 574)).toFile(path.join(RAIZ, 'frontend', 'public', 'logo.png'));
  console.log('✓ frontend/public/logo.png');
  await (await semFundo(FONTE, 144)).toFile(path.join(RAIZ, 'frontend', 'public', 'favicon.png'));
  console.log('✓ frontend/public/favicon.png');

  console.log('\nÍcones sem fundo preto gerados com sucesso.');
})().catch((e) => { console.error('Falhou:', e.message); process.exit(1); });
