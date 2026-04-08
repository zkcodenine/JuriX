/**
 * process-icon.js
 * Processa a logo original (fundo preto) e gera:
 *  - electron/assets/icon.png   → 512×512 com fundo transparente
 *  - electron/assets/icon.ico   → Windows multi-size (16/32/48/256)
 *
 * Uso:
 *   1. Salve a logo em:  electron/assets/logo-original.png
 *   2. Execute:          npm run process-icon
 */

const sharp = require('sharp')
const pngToIco = require('png-to-ico')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const ASSETS = path.join(ROOT, 'electron', 'assets')
// Aceita logo-original.png, logo-original.jpeg, logo-original.png.jpeg, etc.
const INPUT = (() => {
  const candidates = [
    'logo-original.png',
    'logo-original.png.jpeg',
    'logo-original.jpg',
    'logo-original.jpeg',
  ]
  for (const name of candidates) {
    const p = path.join(ASSETS, name)
    if (fs.existsSync(p)) return p
  }
  return path.join(ASSETS, 'logo-original.png') // fallback para mensagem de erro
})()
const OUT_PNG = path.join(ASSETS, 'icon.png')
const OUT_ICO = path.join(ASSETS, 'icon.ico')

async function removeBlackBackground(inputPath, outputPath, size = 512) {
  const { data, info } = await sharp(inputPath)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pixels = new Uint8ClampedArray(data)
  const threshold = 30 // pixels com R,G,B < threshold são considerados "preto"

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    if (r < threshold && g < threshold && b < threshold) {
      pixels[i + 3] = 0 // torna transparente
    }
  }

  await sharp(Buffer.from(pixels), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(outputPath)

  console.log(`✅ PNG gerado: ${outputPath}`)
}

async function generateIco(pngPath, icoPath) {
  // Gera tamanhos intermediários para o .ico
  const sizes = [16, 32, 48, 256]
  const tmpFiles = []

  for (const s of sizes) {
    const tmp = path.join(ASSETS, `_tmp_${s}.png`)
    await sharp(pngPath)
      .resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(tmp)
    tmpFiles.push(tmp)
  }

  const icoBuffer = await pngToIco(tmpFiles)
  fs.writeFileSync(icoPath, icoBuffer)
  console.log(`✅ ICO gerado: ${icoPath}`)

  // Remove temporários
  tmpFiles.forEach((f) => fs.unlinkSync(f))
}

async function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`\n❌ Logo não encontrada em: ${INPUT}`)
    console.error('   Salve a imagem da logo como "logo-original.png" nesse caminho e execute novamente.\n')
    process.exit(1)
  }

  if (!fs.existsSync(ASSETS)) fs.mkdirSync(ASSETS, { recursive: true })

  console.log('\n🎨 Processando logo JuriX...\n')

  await removeBlackBackground(INPUT, OUT_PNG, 512)
  await generateIco(OUT_PNG, OUT_ICO)

  console.log('\n✅ Ícones prontos em electron/assets/\n')
}

main().catch((err) => {
  console.error('❌ Erro:', err.message)
  process.exit(1)
})
