// ═══════════════════════════════════════════════════════════════════
// Utilitário de exportação PDF — Papel Timbrado Profissional
// Layout: canto superior-direito decorativo + rodapé com barra
// Cor das bordas configurável em Dados do Escritório.
// ═══════════════════════════════════════════════════════════════════
import api from '../services/api';

// ── Máscaras ─────────────────────────────────────────────────────
const formatCpfCnpj = (v) => {
  if (!v) return '';
  const digits = String(v).replace(/\D/g, '');
  if (digits.length <= 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

const formatTelefone = (v) => {
  if (!v) return '';
  const digits = String(v).replace(/\D/g, '');
  if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return v;
};

// ── Fetch das configurações do escritório ────────────────────────
export async function fetchEscritorioConfig() {
  try {
    const { data } = await api.get('/configuracoes/escritorio');
    return data || {};
  } catch {
    return {};
  }
}

// ── Logo → base64 (evita CORS em html2canvas) ────────────────────
async function logoToBase64(logoPath) {
  if (!logoPath) return '';
  const origin = window.location.port === '3000'
    ? window.location.origin.replace(':3000', ':3001')
    : window.location.origin;
  const url = /^https?:/i.test(logoPath)
    ? logoPath
    : `${origin}${logoPath.startsWith('/') ? '' : '/'}${logoPath}`;
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

// ── Hexadecimal → rgba ───────────────────────────────────────────
function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ═══════════════════════════════════════════════════════════════════
// Constrói o HTML da página com papel timbrado.
// Retorna apenas <style> + <div class="page"> — sem html/head/body —
// para ser injetado diretamente num container no DOM.
// Layout usa flexbox: sem position:absolute no footer → sem 2ª página
// em branco quando o conteúdo for menor que uma página A4.
// ═══════════════════════════════════════════════════════════════════
export function buildLetterheadPage(config = {}, logoDataUrl = '', bodyHtml = '', pageDate = '') {
  const cor = (config.corDocumento && config.corDocumento.length === 7)
    ? config.corDocumento : '#1a2544';
  const corLight = hexToRgba(cor, 0.12);
  const corMid   = hexToRgba(cor, 0.55);

  const nomeEsc      = config.nomeEscritorio || '';
  const oab          = config.oabEscritorio  || '';
  const cnpjRaw      = config.cnpj           || config.cpf  || '';
  const telefoneRaw  = config.telefone       || '';
  const email        = config.email          || '';
  const site         = config.site           || config.website || '';
  const endereco     = config.endereco       || '';
  const cidade       = config.cidade         || '';
  const rodape       = config.rodapeDocumento || '';

  const cnpjFormatted = formatCpfCnpj(cnpjRaw);
  const cnpjLabel     = cnpjRaw && String(cnpjRaw).replace(/\D/g, '').length <= 11 ? 'CPF' : 'CNPJ';
  const tel           = formatTelefone(telefoneRaw);

  // Lema / subtítulo do cabeçalho (configurável)
  const lema = config.lemaEscritorio || config.subtituloEscritorio || '';

  // Linhas de contato para rodapé (distribuídas em 3 blocos)
  const enderecoCompleto = [endereco, cidade].filter(Boolean).join(' — ');
  const contatoBloco = [tel && `Tel. ${tel}`, email].filter(Boolean).join('  |  ');

  // Rodapé textual (fallback para campo custom)
  const footerCustom = rodape;

  const today = pageDate || new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  return `
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; color: #111; background: #fff; }

  /* ── Página A4 ── */
  .page {
    width: 210mm;
    min-height: 295mm;
    position: relative;
    background: #fff;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ══════════════════════════════════════════════════════════════════
     CABEÇALHO CLÁSSICO ADVOCATÍCIO
     Logo + nome do escritório centralizados, contatos à direita,
     linha dupla decorativa separando do corpo.
     ══════════════════════════════════════════════════════════════════ */
  .header {
    position: relative;
    padding: 12mm 22mm 0 22mm;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10mm;
    min-height: 32mm;
  }

  /* Coluna esquerda — logo + nome */
  .header-brand {
    display: flex;
    align-items: center;
    gap: 5mm;
    flex-shrink: 0;
  }
  .header-brand-logo {
    width: 20mm;
    height: 20mm;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .header-brand-logo img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    display: block;
  }
  .header-brand-text {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .header-office {
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: 15pt;
    font-weight: 700;
    color: ${cor};
    letter-spacing: 0.5px;
    line-height: 1.1;
    text-transform: uppercase;
  }
  .header-sub {
    font-size: 7.5pt;
    color: #666;
    letter-spacing: 2.5px;
    margin-top: 1.2mm;
    text-transform: uppercase;
    font-weight: 500;
  }

  /* Coluna direita — informações de contato */
  .header-info {
    text-align: right;
    font-size: 8.5pt;
    color: #3a3a3a;
    line-height: 1.55;
    padding-top: 1mm;
  }
  .header-info .label {
    color: ${cor};
    font-weight: 700;
    letter-spacing: 0.3px;
  }
  .header-info .date {
    color: #888;
    font-style: italic;
    font-size: 8pt;
    margin-bottom: 2mm;
  }

  /* Linha dupla clássica */
  .header-rule {
    margin: 6mm 22mm 0 22mm;
    border-top: 1.2px solid ${cor};
    border-bottom: 0.4px solid ${cor};
    padding-bottom: 1.2mm;
  }

  /* ── Corpo: flex:1 empurra o footer para o fim da página ── */
  .body-content {
    flex: 1;
    padding: 10mm 22mm 8mm 22mm;
    font-size: 12pt;
    line-height: 1.75;
    text-align: justify;
    color: #1a1a1a;
    hyphens: auto;
  }
  .body-content p {
    text-align: inherit;
    margin: 0 0 8pt 0;
    orphans: 3;
    widows: 3;
  }
  .body-content h1, .body-content h2, .body-content h3 {
    text-align: inherit;
    font-weight: bold;
    margin: 14pt 0 8pt 0;
    line-height: 1.3;
  }
  .body-content h1 { font-size: 14pt; }
  .body-content h2 { font-size: 13pt; }
  .body-content h3 { font-size: 12.5pt; }
  /* Parágrafos detectados automaticamente como título (all-caps curto) */
  .body-content p.doc-title {
    text-align: center;
    font-weight: bold;
    font-size: 12.5pt;
    letter-spacing: 0.5px;
    margin: 14pt 0 10pt 0;
    text-transform: none;
  }
  .body-content p.doc-subtitle {
    text-align: center;
    font-weight: bold;
    font-size: 12pt;
    margin: 12pt 0 8pt 0;
  }
  .body-content p.doc-sig {
    text-align: center;
    margin: 6pt 0 2pt 0;
  }
  /* Primeiro parágrafo sem margin-top */
  .body-content > :first-child { margin-top: 0; }
  /* Quill alignment classes */
  .body-content .ql-align-center  { text-align: center  !important; }
  .body-content .ql-align-right   { text-align: right   !important; }
  .body-content .ql-align-justify { text-align: justify !important; }
  /* Listas */
  .body-content ol, .body-content ul {
    margin: 6pt 0 8pt 18pt;
    padding: 0;
  }
  .body-content li { margin-bottom: 4pt; text-align: inherit; }
  /* Quebras de linha vazias não geram altura excessiva */
  .body-content p:empty { height: 6pt; margin: 0; }
  .body-content p br:only-child { display: none; }

  /* ══════════════════════════════════════════════════════════════════
     RODAPÉ MINIMALISTA — linha dupla + info centralizada em 3 colunas
     ══════════════════════════════════════════════════════════════════ */
  .footer {
    position: relative;
    flex-shrink: 0;
    padding: 0 22mm 10mm 22mm;
    margin-top: 6mm;
  }
  .footer-rule {
    border-top: 0.4px solid ${cor};
    border-bottom: 1.2px solid ${cor};
    margin-bottom: 3mm;
  }
  .footer-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6mm;
    font-size: 7.8pt;
    color: #555;
    line-height: 1.4;
  }
  .footer-col {
    flex: 1;
  }
  .footer-col.left   { text-align: left; }
  .footer-col.center { text-align: center; }
  .footer-col.right  { text-align: right; }
  .footer-col .label {
    display: block;
    font-size: 6.5pt;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: ${cor};
    font-weight: 700;
    margin-bottom: 0.6mm;
  }
  .footer-col .value {
    color: #444;
  }
  .footer-sig {
    text-align: center;
    font-size: 6.5pt;
    color: #999;
    margin-top: 3mm;
    letter-spacing: 1px;
  }
</style>

<div class="page">

  <!-- ═══════════════ CABEÇALHO ═══════════════ -->
  <div class="header">
    <div class="header-brand">
      ${logoDataUrl ? `
      <div class="header-brand-logo">
        <img src="${logoDataUrl}" alt="logo" />
      </div>` : ''}
      <div class="header-brand-text">
        <div class="header-office">${nomeEsc || 'ESCRITÓRIO DE ADVOCACIA'}</div>
        ${lema ? `<div class="header-sub">${lema}</div>` : ''}
      </div>
    </div>

    <div class="header-info">
      <div class="date">${today}</div>
      ${oab ? `<div><span class="label">OAB</span> ${oab}</div>` : ''}
      ${cnpjFormatted ? `<div><span class="label">${cnpjLabel}</span> ${cnpjFormatted}</div>` : ''}
      ${tel ? `<div>${tel}</div>` : ''}
      ${email ? `<div>${email}</div>` : ''}
    </div>
  </div>

  <div class="header-rule"></div>

  <!-- ═══════════════ CORPO ═══════════════ -->
  <div class="body-content">${bodyHtml}</div>

  <!-- ═══════════════ RODAPÉ ═══════════════ -->
  <div class="footer">
    <div class="footer-rule"></div>
    ${footerCustom ? `
    <div class="footer-content" style="justify-content:center;">
      <div class="footer-col center"><div class="value">${footerCustom}</div></div>
    </div>` : `
    <div class="footer-content">
      ${enderecoCompleto ? `
      <div class="footer-col left">
        <span class="label">Endereço</span>
        <span class="value">${enderecoCompleto}</span>
      </div>` : '<div class="footer-col left"></div>'}
      ${contatoBloco ? `
      <div class="footer-col center">
        <span class="label">Contato</span>
        <span class="value">${contatoBloco}</span>
      </div>` : '<div class="footer-col center"></div>'}
      ${site ? `
      <div class="footer-col right">
        <span class="label">Website</span>
        <span class="value">${site}</span>
      </div>` : '<div class="footer-col right"></div>'}
    </div>`}
  </div>

</div>`;
}

// ═══════════════════════════════════════════════════════════════════
// Pré-processa o HTML do Quill para adicionar classes visuais:
//  • p all-caps curto  → .doc-title  (centralizado, bold, maior)
//  • "Ementa:", "DA ..." → .doc-subtitle
//  • Linha com traços longos ou "Assinatura" → .doc-sig
// ═══════════════════════════════════════════════════════════════════
function enhanceBodyHtml(html) {
  if (!html || typeof html !== 'string') return html || '';
  try {
    const container = document.createElement('div');
    container.innerHTML = html;
    const ps = container.querySelectorAll('p');
    ps.forEach((p) => {
      const txt = (p.textContent || '').trim();
      if (!txt) return;
      const len = txt.length;
      const letters = txt.replace(/[^A-Za-zÀ-ÿ]/g, '');
      const upper = letters.replace(/[^A-ZÀ-Ý]/g, '');
      const isUpper = letters.length > 3 && upper.length / letters.length >= 0.9;

      // Título — curto, all-caps
      if (isUpper && len <= 90) {
        p.classList.add('doc-title');
        return;
      }
      // Subtítulo — all-caps médio, ou começa com palavras-chave
      if (isUpper && len <= 180) {
        p.classList.add('doc-subtitle');
        return;
      }
      // Assinatura — linha só com underline/traços
      if (/^[_\-–—\s]{8,}$/.test(txt)) {
        p.classList.add('doc-sig');
        return;
      }
    });
    return container.innerHTML;
  } catch {
    return html;
  }
}

// ── Linhas do rodapé (mantido p/ compatibilidade) ────────────────
export function buildHeaderHtml() { return ''; }
export function buildFooterLines(config = {}) {
  const rodape = config.rodapeDocumento || '';
  if (rodape) return [rodape];
  const parts = [];
  const tel = formatTelefone(config.telefone || '');
  if (config.endereco) parts.push(config.endereco + (config.cidade ? ` — ${config.cidade}` : ''));
  if (tel)             parts.push(`Tel: ${tel}`);
  if (config.email)    parts.push(config.email);
  if (config.site)     parts.push(config.site);
  return parts;
}

// ═══════════════════════════════════════════════════════════════════
// Exporta HTML como PDF com papel timbrado profissional.
// Monta o HTML num container oculto no DOM para garantir renderização
// correta dos estilos e eliminar página extra em branco.
// ═══════════════════════════════════════════════════════════════════
export async function exportarPDFComCabecalho(htmlContent, filename, { toast } = {}) {
  const html2pdf = (await import('html2pdf.js')).default;
  const config      = await fetchEscritorioConfig();
  const logoDataUrl = await logoToBase64(config.logoEscritorio);

  const today    = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const enhanced = enhanceBodyHtml(htmlContent);
  const pageHtml = buildLetterheadPage(config, logoDataUrl, enhanced, today);

  // Monta em container oculto no DOM (garante CSS aplicado corretamente)
  const container = document.createElement('div');
  container.style.cssText = 'position:absolute;left:-9999px;top:0;width:794px;';
  container.innerHTML = pageHtml;
  document.body.appendChild(container);

  const element = container.querySelector('.page');

  const cleanName = String(filename || 'documento').replace(/[^a-zA-Z0-9 \-_.]/g, '').trim();
  const finalName = cleanName.endsWith('.pdf') ? cleanName : `${cleanName}.pdf`;

  const opt = {
    margin:     0,
    filename:   finalName,
    image:      { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, width: 794, logging: false, windowWidth: 794 },
    jsPDF:      { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
    pagebreak:  { mode: ['css', 'legacy'], avoid: '.footer' },
  };

  if (toast) toast.loading('Gerando PDF...', { id: 'pdf-toast' });

  try {
    await html2pdf().from(element).set(opt).save();
    if (toast) toast.success('PDF baixado!', { id: 'pdf-toast' });
  } catch (err) {
    if (toast) toast.error('Erro ao gerar PDF.', { id: 'pdf-toast' });
    throw err;
  } finally {
    // Remove o container temporário do DOM
    try { document.body.removeChild(container); } catch (_) {}
  }
}
