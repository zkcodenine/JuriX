// ══════════════════════════════════════════════════════
//  JuriX — DataJud Service (CNJ)
//  Integração com a API pública do DataJud
//  Docs: https://datajud-wiki.cnj.jus.br
// ══════════════════════════════════════════════════════
const axios = require('axios');
const crypto = require('crypto');
const { cacheGet, cacheSet } = require('../config/redis');
const logger = require('../config/logger');

const DATAJUD_BASE_URL = process.env.DATAJUD_API_URL || 'https://api-publica.datajud.cnj.jus.br';
const DATAJUD_API_KEY  = process.env.DATAJUD_API_KEY  || 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

// Mapeamento de tribunais para índices ElasticSearch do DataJud
// Fonte: https://datajud-wiki.cnj.jus.br/api-publica/endpoints
const TRIBUNAL_INDEX = {
  // ── Justiça Estadual (TJ) ──────────────────────────
  'TJAC': 'api_publica_tjac',
  'TJAL': 'api_publica_tjal',
  'TJAM': 'api_publica_tjam',
  'TJAP': 'api_publica_tjap',
  'TJBA': 'api_publica_tjba',
  'TJCE': 'api_publica_tjce',
  'TJDF': 'api_publica_tjdft',
  'TJDFT': 'api_publica_tjdft',
  'TJES': 'api_publica_tjes',
  'TJGO': 'api_publica_tjgo',
  'TJMA': 'api_publica_tjma',
  'TJMG': 'api_publica_tjmg',
  'TJMS': 'api_publica_tjms',
  'TJMT': 'api_publica_tjmt',
  'TJPA': 'api_publica_tjpa',
  'TJPB': 'api_publica_tjpb',
  'TJPE': 'api_publica_tjpe',
  'TJPI': 'api_publica_tjpi',
  'TJPR': 'api_publica_tjpr',
  'TJRJ': 'api_publica_tjrj',
  'TJRN': 'api_publica_tjrn',
  'TJRO': 'api_publica_tjro',
  'TJRR': 'api_publica_tjrr',
  'TJRS': 'api_publica_tjrs',
  'TJSC': 'api_publica_tjsc',
  'TJSE': 'api_publica_tjse',
  'TJSP': 'api_publica_tjsp',
  'TJTO': 'api_publica_tjto',
  // ── Justiça Militar Estadual (TJM) ────────────────
  'TJMMG': 'api_publica_tjmmg',
  'TJMRS': 'api_publica_tjmrs',
  'TJMSP': 'api_publica_tjmsp',
  // ── Tribunais Superiores ───────────────────────────
  'STF':  'api_publica_stf',
  'STJ':  'api_publica_stj',
  'STM':  'api_publica_stm',
  'TST':  'api_publica_tst',
  'TSE':  'api_publica_tse',
  // ── Justiça Federal (TRF) ─────────────────────────
  'TRF1': 'api_publica_trf1',
  'TRF2': 'api_publica_trf2',
  'TRF3': 'api_publica_trf3',
  'TRF4': 'api_publica_trf4',
  'TRF5': 'api_publica_trf5',
  'TRF6': 'api_publica_trf6',
  // ── Justiça do Trabalho (TRT) ─────────────────────
  'TRT1':  'api_publica_trt1',
  'TRT2':  'api_publica_trt2',
  'TRT3':  'api_publica_trt3',
  'TRT4':  'api_publica_trt4',
  'TRT5':  'api_publica_trt5',
  'TRT6':  'api_publica_trt6',
  'TRT7':  'api_publica_trt7',
  'TRT8':  'api_publica_trt8',
  'TRT9':  'api_publica_trt9',
  'TRT10': 'api_publica_trt10',
  'TRT11': 'api_publica_trt11',
  'TRT12': 'api_publica_trt12',
  'TRT13': 'api_publica_trt13',
  'TRT14': 'api_publica_trt14',
  'TRT15': 'api_publica_trt15',
  'TRT16': 'api_publica_trt16',
  'TRT17': 'api_publica_trt17',
  'TRT18': 'api_publica_trt18',
  'TRT19': 'api_publica_trt19',
  'TRT20': 'api_publica_trt20',
  'TRT21': 'api_publica_trt21',
  'TRT22': 'api_publica_trt22',
  'TRT23': 'api_publica_trt23',
  'TRT24': 'api_publica_trt24',
  // ── Justiça Eleitoral (TRE) ───────────────────────
  'TREAC': 'api_publica_tre-ac',
  'TREAL': 'api_publica_tre-al',
  'TREAM': 'api_publica_tre-am',
  'TREAP': 'api_publica_tre-ap',
  'TREBA': 'api_publica_tre-ba',
  'TRECE': 'api_publica_tre-ce',
  'TREDF': 'api_publica_tre-df',
  'TREES': 'api_publica_tre-es',
  'TREGO': 'api_publica_tre-go',
  'TREMA': 'api_publica_tre-ma',
  'TREMG': 'api_publica_tre-mg',
  'TREMS': 'api_publica_tre-ms',
  'TREMT': 'api_publica_tre-mt',
  'TREPA': 'api_publica_tre-pa',
  'TREPB': 'api_publica_tre-pb',
  'TREPE': 'api_publica_tre-pe',
  'TREPI': 'api_publica_tre-pi',
  'TREPR': 'api_publica_tre-pr',
  'TRERJ': 'api_publica_tre-rj',
  'TRERN': 'api_publica_tre-rn',
  'TRERO': 'api_publica_tre-ro',
  'TRERR': 'api_publica_tre-rr',
  'TRERS': 'api_publica_tre-rs',
  'TRESC': 'api_publica_tre-sc',
  'TRESE': 'api_publica_tre-se',
  'TRESP': 'api_publica_tre-sp',
  'TRETO': 'api_publica_tre-to',
};

const httpClient = axios.create({
  baseURL: DATAJUD_BASE_URL,
  timeout: 30000,
  headers: {
    'Authorization': `APIKey ${DATAJUD_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

// ─── Gerar hash único para movimentação CNJ ────────
function _gerarHashCNJ(rawDigits, dataHora, nome) {
  const descLimpa = (nome || '').slice(0, 80).replace(/\s+/g, '_').toLowerCase();
  const conteudo = `cnj_${rawDigits}_${dataHora}_${descLimpa}`;
  const md5 = crypto.createHash('md5').update(conteudo).digest('hex').slice(0, 12);
  return `cnj_${rawDigits}_${dataHora}_${md5}`;
}

// ─── Parser seguro de datas (evita Invalid Date no Prisma) ─
function _safeDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ─── Formatar número CNJ internamente ──────────────
function _formatarCNJ(numero) {
  const digits = numero.replace(/\D/g, '');
  if (digits.length !== 20) return numero.trim();
  return `${digits.slice(0,7)}-${digits.slice(7,9)}.${digits.slice(9,13)}.${digits.slice(13,14)}.${digits.slice(14,16)}.${digits.slice(16)}`;
}

// ─── Gerar variações do número CNJ para busca robusta ──
function _variacoesCNJ(numeroCnj) {
  const digits = numeroCnj.replace(/\D/g, '');
  if (digits.length !== 20) return [numeroCnj.trim()];

  // Formato padrão CNJ: NNNNNNN-DD.AAAA.J.TT.OOOO
  const fmt1 = `${digits.slice(0,7)}-${digits.slice(7,9)}.${digits.slice(9,13)}.${digits.slice(13,14)}.${digits.slice(14,16)}.${digits.slice(16)}`;
  // Variação sem o ponto antes do segmento de justiça (alguns tribunais): NNNNNNN-DD.AAAA.J.TTOOOO
  const fmt2 = `${digits.slice(0,7)}-${digits.slice(7,9)}.${digits.slice(9,13)}.${digits.slice(13,14)}.${digits.slice(14)}`;
  // Variação com segmento J e TT sem separação: NNNNNNN-DD.AAAA.JTT.OOOO
  const fmt3 = `${digits.slice(0,7)}-${digits.slice(7,9)}.${digits.slice(9,13)}.${digits.slice(13,16)}.${digits.slice(16)}`;

  return [...new Set([fmt1, fmt2, fmt3, numeroCnj.trim()])].filter(Boolean);
}

// ─── Consultar processo por número CNJ ─────────────
async function consultarProcesso(numeroCnj, tribunal) {
  const numeroNormalizado = _formatarCNJ(numeroCnj);
  const rawDigits = numeroCnj.replace(/\D/g, '');
  const cacheKey = `datajud:${rawDigits}:${tribunal}`;

  const cached = await cacheGet(cacheKey);
  if (cached) {
    logger.info(`DataJud cache hit: ${rawDigits}`);
    return cached;
  }

  const indice = TRIBUNAL_INDEX[tribunal.toUpperCase()] || `api_publica_${tribunal.toLowerCase()}`;

  logger.info(`DataJud consultando: "${rawDigits}" (formatado: "${numeroNormalizado}") no índice "${indice}"`);

  try {
    // Estratégia conforme documentação oficial do DataJud:
    // Primary: match com dígitos brutos (formato documentado pelo CNJ)
    // Fallback: term exato no .keyword tanto com dígitos brutos quanto formatado
    const payload = {
      size: 1,
      query: {
        bool: {
          should: [
            { match: { numeroProcesso: rawDigits } },
            { term:  { 'numeroProcesso.keyword': rawDigits } },
            { term:  { 'numeroProcesso.keyword': numeroNormalizado } },
          ],
          minimum_should_match: 1,
        },
      },
    };

    logger.info(`DataJud payload: ${JSON.stringify(payload)}`);

    const response = await httpClient.post(`/${indice}/_search`, payload);

    const hits = response.data?.hits?.hits;
    if (!hits || hits.length === 0) {
      logger.warn(`DataJud: processo "${numeroNormalizado}" NÃO encontrado em ${indice}`);
      logger.warn(`DataJud total hits: ${response.data?.hits?.total?.value}`);
      return null;
    }

    logger.info(`DataJud: ENCONTRADO! _id=${hits[0]._id} score=${hits[0]._score}`);

    const processo = hits[0]._source;
    const resultado = normalizarProcesso(processo, numeroNormalizado, tribunal);

    // Cache por 1 hora
    await cacheSet(cacheKey, resultado, 3600);

    return resultado;
  } catch (error) {
    const status  = error.response?.status;
    const errBody = JSON.stringify(error.response?.data || {});
    logger.error(`DataJud erro ao consultar ${numeroNormalizado}: status=${status} body=${errBody} msg=${error.message}`);
    if (status === 404) return null;
    throw new Error(`Falha na consulta ao DataJud (${status || error.message})`);
  }
}

// ─── Verificar novas movimentações ─────────────────
async function verificarMovimentacoes(numeroCnj, tribunal, ultimaData) {
  try {
    const rawDigits = numeroCnj.replace(/\D/g, '');
    const indice = TRIBUNAL_INDEX[tribunal?.toUpperCase()] || `api_publica_${tribunal?.toLowerCase()}`;
    const payload = {
      query: {
        bool: {
          should: [
            { match: { numeroProcesso: rawDigits } },
            { term:  { 'numeroProcesso.keyword': rawDigits } },
          ],
          minimum_should_match: 1,
        },
      },
      _source: ['movimentos', 'numeroProcesso', 'tribunal', 'orgaoJulgador'],
    };

    const response = await httpClient.post(`/${indice}/_search`, payload);
    const hits = response.data?.hits?.hits;
    if (!hits || hits.length === 0) return [];

    const processo = hits[0]._source;
    const movimentos = processo.movimentos || [];

    // Filtra apenas movimentos com data válida e após a última data registrada
    return movimentos
      .filter(m => {
        const dataStr = _safeDate(m.dataHora);
        if (!dataStr) return false;
        return !ultimaData || new Date(dataStr) > ultimaData;
      })
      .map(m => {
        const data = _safeDate(m.dataHora);
        const descricao = (m.nome || m.complementosTabelados?.[0]?.descricao || 'Movimentação').slice(0, 500);
        return {
          data: new Date(data),
          descricao,
          tipo: m.nome || null,
          origemApi: 'datajud',
          hashExterno: _gerarHashCNJ(rawDigits, data, descricao),
        };
      });
  } catch (error) {
    logger.error(`DataJud verificarMovimentacoes erro:`, error.message);
    return [];
  }
}

// ─── Mapear polo do DataJud para tipo de parte JuriX ──
function _mapearPolo(polo) {
  if (!polo) return 'TERCEIRO';
  const p = polo.toUpperCase().trim();
  // DataJud retorna 'AT' ou 'ATIVO' para polo ativo, 'PA' ou 'PASSIVO' para polo passivo
  if (p === 'AT' || p === 'ATIVO' || p === 'POLO_ATIVO' || p === 'REQUERENTE' || p === 'AUTOR') return 'AUTOR';
  if (p === 'PA' || p === 'PASSIVO' || p === 'POLO_PASSIVO' || p === 'REQUERIDO' || p === 'REU') return 'REU';
  return 'TERCEIRO';
}

// ─── Extrair nome da parte (DataJud tem formatos variados) ──
function _extrairNomeParte(p) {
  // Formato direto: { nome: "..." }
  if (p.nome && typeof p.nome === 'string') return p.nome.trim();
  // Formato aninhado: { pessoa: { nome: "..." } }
  if (p.pessoa?.nome) return p.pessoa.nome.trim();
  // Formato com tipoParte: { tipoParte: { nome: "..." }, nomeCompleto: "..." }
  if (p.nomeCompleto) return p.nomeCompleto.trim();
  return null;
}

// ─── Normalizar resposta do DataJud ────────────────
function normalizarProcesso(dados, numeroCnj, tribunal) {
  const rawDigits = numeroCnj.replace(/\D/g, '');

  // Extrair partes com suporte a múltiplos formatos da API DataJud
  const partesRaw = dados.partes || dados.polos || [];
  const partes = partesRaw
    .map(p => {
      const nome = _extrairNomeParte(p);
      if (!nome) return null;
      return { nome, tipo: _mapearPolo(p.polo || p.tipoParte) };
    })
    .filter(Boolean);

  // Extrair advogados de dentro das partes
  const advogados = partesRaw
    .flatMap(p => {
      const advs = p.advogados || p.representantes || [];
      return advs.map(a => ({
        nome: a.nome || a.pessoa?.nome || null,
        numeroDocumentoPrincipal: a.numeroDocumentoPrincipal || a.inscricao || null,
        polo: p.polo || null,
      }));
    })
    .filter(a => a.nome);

  // Importar TODAS as movimentações (sem limite)
  const movimentacoes = (dados.movimentos || [])
    .map(m => {
      const data = _safeDate(m.dataHora);
      const descricao = (m.nome || m.complementosTabelados?.[0]?.descricao || 'Movimentação').slice(0, 500);
      return {
        data,
        descricao,
        tipo: m.nome || null,
        hashExterno: _gerarHashCNJ(rawDigits, data || m.dataHora, descricao),
      };
    })
    .filter(m => m.data);

  return {
    numero: dados.numeroProcesso || numeroCnj,
    numeroCnj: numeroCnj,
    tribunal: dados.tribunal?.nome || tribunal,
    vara: dados.orgaoJulgador?.nome || null,
    classe: dados.classe?.nome || null,
    assunto: dados.assuntos?.[0]?.nome || null,
    dataDistribuicao: _safeDate(dados.dataAjuizamento) || _safeDate(dados.dataHoraUltimaAtualizacao) || null,
    partes,
    advogados,
    movimentacoes,
  };
}

// ─── Validar número CNJ ────────────────────────────
function validarNumeroCNJ(numero) {
  const limpo = numero.replace(/\D/g, '');
  return limpo.length === 20;
}

// ─── Formatar número CNJ ───────────────────────────
function formatarNumeroCNJ(numero) {
  const limpo = numero.replace(/\D/g, '');
  if (limpo.length !== 20) return numero;
  return `${limpo.slice(0, 7)}-${limpo.slice(7, 9)}.${limpo.slice(9, 13)}.${limpo.slice(13, 14)}.${limpo.slice(14, 16)}.${limpo.slice(16)}`;
}

module.exports = {
  consultarProcesso,
  verificarMovimentacoes,
  validarNumeroCNJ,
  formatarNumeroCNJ,
  TRIBUNAL_INDEX,
};
