// ══════════════════════════════════════════════════════════════
//  JuriX — Atualiza todos os assets de logo/ícone do aplicativo
//  Lê uma imagem fonte única e gera:
//    - frontend/public/logo.png         (512x512)
//    - electron/assets/icon.png         (512x512)
//    - electron/assets/icon.ico         (multi-size Windows)
//    - frontend/public/favicon.svg      (SVG com PNG embutido)
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico');

const SRC = process.argv[2] || 'C:/Users/erick/Desktop/Logo JuriX/Logo JuriX.png';
const ROOT = path.resolve(__dirname, '..');

const outputs = {
  logoPng:    path.join(ROOT, 'frontend/public/logo.png'),
  iconPng:    path.join(ROOT, 'electron/assets/icon.png'),
  iconIco:    path.join(ROOT, 'electron/assets/icon.ico'),
  faviconSvg: path.join(ROOT, 'frontend/public/favicon.svg'),
  faviconPng: path.join(ROOT, 'frontend/public/favicon.png'),
};

async function main() {
  console.log(`[logo] source: ${SRC}`);
  if (!fs.existsSync(SRC)) {
    console.error('[logo] arquivo fonte não encontrado');
    process.exit(1);
  }

  // 512x512 master (com fundo transparente, contain)
  const master = await sharp(SRC)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // 1) logo.png (frontend + PWA)
  fs.writeFileSync(outputs.logoPng, master);
  console.log(`[logo] ✔ ${path.relative(ROOT, outputs.logoPng)}`);

  // 2) icon.png (Linux / loading / fallback)
  fs.writeFileSync(outputs.iconPng, master);
  console.log(`[logo] ✔ ${path.relative(ROOT, outputs.iconPng)}`);

  // 3) icon.ico (Windows — multi-size 16/24/32/48/64/128/256)
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngBuffers = await Promise.all(
    sizes.map(size =>
      sharp(SRC)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
    )
  );
  const ico = await pngToIco(pngBuffers);
  fs.writeFileSync(outputs.iconIco, ico);
  console.log(`[logo] ✔ ${path.relative(ROOT, outputs.iconIco)} (${sizes.join(',')})`);

  // 4) favicon.png (256x256)
  const fav = await sharp(SRC)
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  fs.writeFileSync(outputs.faviconPng, fav);
  console.log(`[logo] ✔ ${path.relative(ROOT, outputs.faviconPng)}`);

  // 5) favicon.svg — SVG wrapper com PNG embutido (mantém caminho usado no index.html)
  const b64 = fav.toString('base64');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <image href="data:image/png;base64,${b64}" width="256" height="256" />
</svg>
`;
  fs.writeFileSync(outputs.faviconSvg, svg);
  console.log(`[logo] ✔ ${path.relative(ROOT, outputs.faviconSvg)}`);

  console.log('\n[logo] Todos os assets atualizados com sucesso.');
}

main().catch(err => {
  console.error('[logo] falhou:', err);
  process.exit(1);
});
