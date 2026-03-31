// ══════════════════════════════════════════════════════
//  JuriX — InfoSimples Provider (genérico)
//  Wrapper para a API InfoSimples que suporta múltiplos
//  tribunais. Pode ser usado como base para integrar
//  qualquer tribunal suportado pela InfoSimples.
//
//  Tribunais suportados pela InfoSimples:
//  - TJMG, TJSP, TJRJ, TJPR, TJPE, TJBA, TJRS, TJSC,
//    TJGO, TJDF, TRT2, TRF2, TRF4, e muitos outros.
//
//  Env: INFOSIMPLES_TOKEN
//
//  Uso futuro:
//    const provider = new InfoSimplesProvider('TJSP', 'tjsp');
//    registry.registrar(provider);
// ══════════════════════════════════════════════════════
const axios = require('axios');
const crypto = require('crypto');
const BaseTribunalProvider = require('./baseTribunalProvider');
const { cacheGet, cacheSet } = require('../../config/redis');
const logger = require('../../config/logger');

const INFOSIMPLES_BASE = 'https://api.infosimples.com/api/v2/consultas/tribunal';
const INFOSIMPLES_TOKEN = process.env.INFOSIMPLES_TOKEN || '';

// ─── Helpers ──────────────────────────────────────────
function _safeDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function _parseDateBR(dataStr) {
  if (!dataStr) return null;
  const m = dataStr.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return _safeDate(dataStr);
  const [, dia, mes, ano, hora, minuto, segundo] = m;
  return _safeDate(`${ano}-${mes}-${dia}T${hora || '00'}:${minuto || '00'}:${segundo || '00'}`);
}

function _formatarCNJ(numero) {
  const digits = numero.replace(/\D/g, '');
  if (digits.length !== 20) return numero.trim();
  return `${digits.slice(0,7)}-${digits.slice(7,9)}.${digits.slice(9,13)}.${digits.slice(13,14)}.${digits.slice(14,16)}.${digits.slice(16)}`;
}

function _gerarHash(prefixo, rawDigits, data, descricao) {
  const descLimpa = (descricao || '').slice(0, 80).replace(/\s+/g, '_').toLowerCase();
  const conteudo = `${prefixo}_${rawDigits}_${data}_${descLimpa}`;
  const md5 = crypto.createHash('md5').update(conteudo).digest('hex').slice(0, 12);
  return `${prefixo}_${rawDigits}_${data}_${md5}`;
}

// Mapeamento de código de tribunal para slug da InfoSimples
const TRIBUNAL_SLUGS = {
  'TJMG': 'tjmg', 'TJSP': 'tjsp', 'TJRJ': 'tjrj', 'TJPR': 'tjpr',
  'TJPE': 'tjpe', 'TJBA': 'tjba', 'TJRS': 'tjrs', 'TJSC': 'tjsc',
  'TJGO': 'tjgo', 'TJDF': 'tjdft', 'TJDFT': 'tjdft', 'TJES': 'tjes',
  'TJCE': 'tjce', 'TJPA': 'tjpa', 'TJAM': 'tjam', 'TJMT': 'tjmt',
  'TJMS': 'tjms', 'TJMA': 'tjma', 'TJAL': 'tjal', 'TJSE': 'tjse',
  'TJPI': 'tjpi', 'TJRN': 'tjrn', 'TJPB': 'tjpb', 'TJAC': 'tjac',
  'TJAP': 'tjap', 'TJRO': 'tjro', 'TJRR': 'tjrr', 'TJTO': 'tjto',
  'TRT2': 'trt2', 'TRF2': 'trf2', 'TRF4': 'trf4',
};

class InfoSimplesProvider extends BaseTribunalProvider {
  /**
   * @param {string} codigoTribunal — Ex: 'TJSP', 'TJRJ'
   * @param {string} [slug] — Slug na URL InfoSimples (ex: 'tjsp'). Auto-detectado se omitido.
   */
  constructor(codigoTribunal, slug) {
    const nome = `Tribunal ${codigoTribunal} (via InfoSimples)`;
    super(codigoTribunal, nome);
    this.slug = slug || TRIBUNAL_SLUGS[codigoTribunal] || codigoTribunal.toLowerCase();
    this.origemTag = codigoTribunal.toLowerCase();
  }

  /**
   * Consulta processo completo via InfoSimples
   */
  async consultarProcesso(numeroCnj, tribunal) {
    const rawDigits = numeroCnj.replace(/\D/g, '');
    const cacheKey = `infosimples:${this.codigo}:${rawDigits}`;

    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    if (!INFOSIMPLES_TOKEN) {
      logger.warn(`InfoSimples [${this.codigo}]: token não configurado`);
      return null;
    }

    try {
      const response = await axios.post(
        `${INFOSIMPLES_BASE}/${this.slug}/processo`,
        new URLSearchParams({
          token: INFOSIMPLES_TOKEN,
          numero_processo: _formatarCNJ(numeroCnj),
          timeout: '300',
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 120000,
        }
      );

      const body = response.data;
      if (!body || (body.code !== 200 && body.code !== undefined)) {
        logger.warn(`InfoSimples [${this.codigo}]: código ${body?.code} - ${body?.code_message || ''}`);
        return null;
      }

      const dados = Array.isArray(body.data) ? body.data[0] : body.data;
      if (!dados) return null;

      const resultado = this._normalizar(dados, numeroCnj, rawDigits);
      await cacheSet(cacheKey, resultado, 1800);

      logger.info(`InfoSimples [${this.codigo}]: ${resultado.movimentacoes?.length || 0} movs, ${resultado.partes?.length || 0} partes`);
      return resultado;
    } catch (err) {
      if (err.response?.data?.code === 601) {
        logger.error(`InfoSimples [${this.codigo}]: TOKEN INVÁLIDO`);
      } else {
        logger.warn(`InfoSimples [${this.codigo}]: ${err.message}`);
      }
      return null;
    }
  }

  /**
   * Verificar movimentações via InfoSimples
   */
  async verificarMovimentacoes(numeroCnj, tribunal, ultimaData) {
    const resultado = await this.consultarProcesso(numeroCnj, tribunal);
    if (!resultado?.movimentacoes?.length) return [];

    let movs = resultado.movimentacoes.map(m => ({
      data: new Date(m.data),
      descricao: m.descricao?.slice(0, 500) || 'Movimentação',
      tipo: m.tipo || null,
      origemApi: this.origemTag,
      hashExterno: m.hashExterno,
    }));

    if (ultimaData) {
      movs = movs.filter(m => new Date(m.data) > ultimaData);
    }

    return movs.sort((a, b) => new Date(b.data) - new Date(a.data));
  }

  /**
   * Normalizar resposta InfoSimples → formato JuriX
   */
  _normalizar(dados, numeroCnj, rawDigits) {
    // Movimentações
    const movimentacoes = [];
    const movRaw = dados.movimento_processo || dados.movimentos || dados.movimentacoes || [];

    for (const m of (Array.isArray(movRaw) ? movRaw : [])) {
      const dataStr = m.data_hora_movimentacao || m.data_hora || m.data || m.dataHora;
      const descricao = (m.descricao || m.movimento || m.nome || m.complemento || '').replace(/\s+/g, ' ').trim();
      const data = _parseDateBR(dataStr) || _safeDate(dataStr);
      if (!data || !descricao || descricao.length < 2) continue;

      movimentacoes.push({
        data,
        descricao: descricao.slice(0, 500),
        tipo: m.tipo || m.tipo_movimento || null,
        hashExterno: _gerarHash(this.origemTag, rawDigits, data, descricao),
      });
    }

    // Partes
    const partes = [];
    const seen = new Set();
    const addPartes = (lista, tipo) => {
      const items = Array.isArray(lista) ? lista : (typeof lista === 'string' ? lista.split(/[,;]/) : []);
      for (const p of items) {
        const nome = (typeof p === 'string' ? p : (p.nome || p.nome_parte || p.razao_social || '')).trim();
        if (!nome || nome.length < 2 || seen.has(nome.toLowerCase())) continue;
        seen.add(nome.toLowerCase());
        partes.push({ nome, tipo });
      }
    };
    addPartes(dados.polo_ativo, 'AUTOR');
    addPartes(dados.polo_passivo, 'REU');
    addPartes(dados.outros_interessados, 'TERCEIRO');

    // Advogados
    const advogados = [];
    const extractAdvs = (lista) => {
      if (!Array.isArray(lista)) return;
      for (const p of lista) {
        for (const a of (p.advogados || p.representantes || [])) {
          const nome = (a.nome || a.nome_advogado || '').trim();
          if (nome) advogados.push({ nome, numeroDocumentoPrincipal: a.oab || a.numero_oab || null, polo: null });
        }
      }
    };
    extractAdvs(dados.polo_ativo);
    extractAdvs(dados.polo_passivo);

    return {
      numero: dados.numero_processo || numeroCnj,
      numeroCnj: _formatarCNJ(numeroCnj),
      tribunal: this.codigo,
      vara: dados.orgao_julgador || dados.vara || null,
      classe: dados.classe_judicial || dados.classe || null,
      assunto: dados.assunto || null,
      dataDistribuicao: _parseDateBR(dados.data_distribuicao) || _safeDate(dados.data_distribuicao),
      partes,
      advogados,
      movimentacoes,
      origemApi: this.origemTag,
    };
  }
}

module.exports = { InfoSimplesProvider, TRIBUNAL_SLUGS, INFOSIMPLES_TOKEN };
