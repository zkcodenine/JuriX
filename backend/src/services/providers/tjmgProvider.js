// ══════════════════════════════════════════════════════
//  JuriX — TJMG Provider (v3)
//  Integração com TJMG via InfoSimples API + DataJud fallback
//
//  Prioridade de fontes:
//  1. InfoSimples API (dados em tempo real do PJe)
//  2. DataJud (fallback CNJ - pode ter atraso)
//
//  A InfoSimples faz scraping profissional do PJe e retorna
//  JSON limpo com TODAS as movimentações, partes e dados.
//
//  Env vars necessárias:
//  - INFOSIMPLES_TOKEN: token da API InfoSimples
//
//  Endpoint: POST https://api.infosimples.com/api/v2/consultas/tribunal/tjmg/processo
// ══════════════════════════════════════════════════════
const axios = require('axios');
const crypto = require('crypto');
const BaseTribunalProvider = require('./baseTribunalProvider');
const datajudService = require('../datajudService');
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

function _formatarCNJ(numero) {
  const digits = numero.replace(/\D/g, '');
  if (digits.length !== 20) return numero.trim();
  return `${digits.slice(0,7)}-${digits.slice(7,9)}.${digits.slice(9,13)}.${digits.slice(13,14)}.${digits.slice(14,16)}.${digits.slice(16)}`;
}

/**
 * Parseia data brasileira DD/MM/YYYY HH:MM:SS para ISO string
 */
function _parseDateBR(dataStr) {
  if (!dataStr) return null;
  // Formato: DD/MM/YYYY HH:MM:SS ou DD/MM/YYYY HH:MM ou DD/MM/YYYY
  const m = dataStr.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) {
    // Tenta ISO direto
    return _safeDate(dataStr);
  }
  const [, dia, mes, ano, hora, minuto, segundo] = m;
  const iso = `${ano}-${mes}-${dia}T${hora || '00'}:${minuto || '00'}:${segundo || '00'}`;
  return _safeDate(iso);
}

/**
 * Gera hash único para movimentação incluindo conteúdo da descrição
 */
function _gerarHash(prefixo, rawDigits, data, descricao) {
  const descLimpa = (descricao || '').slice(0, 80).replace(/\s+/g, '_').toLowerCase();
  const conteudo = `${prefixo}_${rawDigits}_${data}_${descLimpa}`;
  const md5 = crypto.createHash('md5').update(conteudo).digest('hex').slice(0, 12);
  return `${prefixo}_${rawDigits}_${data}_${md5}`;
}

// ═══════════════════════════════════════════════════════
//  TJMG Provider
// ═══════════════════════════════════════════════════════
class TjmgProvider extends BaseTribunalProvider {
  constructor() {
    super('TJMG', 'Tribunal de Justiça de Minas Gerais');
    this._infoSimplesDisponivel = !!INFOSIMPLES_TOKEN;
    if (!this._infoSimplesDisponivel) {
      logger.warn('TJMG Provider: INFOSIMPLES_TOKEN não configurado. Usando apenas DataJud como fonte.');
    } else {
      logger.info('TJMG Provider: InfoSimples API configurada como fonte primária.');
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Consultar processo completo
  // ═══════════════════════════════════════════════════════
  async consultarProcesso(numeroCnj, tribunal = 'TJMG') {
    const rawDigits = numeroCnj.replace(/\D/g, '');
    const cacheKey = `tjmg:processo:${rawDigits}`;

    const cached = await cacheGet(cacheKey);
    if (cached) {
      logger.info(`TJMG Provider cache hit: ${rawDigits}`);
      return cached;
    }

    logger.info(`TJMG Provider: consultando processo ${_formatarCNJ(numeroCnj)}...`);

    let resultado = null;

    // ── Fonte 1: InfoSimples API (prioridade) ──────────
    if (this._infoSimplesDisponivel) {
      resultado = await this._consultarInfoSimples(numeroCnj, 'tjmg');
    }

    // ── Fonte 2: DataJud (fallback) ────────────────────
    if (!resultado) {
      logger.info('TJMG Provider: usando fallback DataJud...');
      resultado = await datajudService.consultarProcesso(numeroCnj, 'TJMG');
      if (resultado) resultado.origemApi = 'datajud';
    }

    // Se obteve dados do DataJud mas InfoSimples está disponível,
    // tenta complementar movimentações via InfoSimples
    if (resultado && resultado.origemApi === 'datajud' && this._infoSimplesDisponivel) {
      try {
        const dadosIS = await this._consultarInfoSimples(numeroCnj, 'tjmg');
        if (dadosIS && (dadosIS.movimentacoes?.length || 0) > (resultado.movimentacoes?.length || 0)) {
          logger.info(`TJMG Provider: complementando DataJud com ${dadosIS.movimentacoes.length} movimentações do InfoSimples`);
          resultado.movimentacoes = this._mergeMovimentacoes(resultado.movimentacoes || [], dadosIS.movimentacoes, rawDigits);
          resultado.origemApi = 'tjmg';
        }
      } catch (err) {
        logger.debug(`TJMG Provider: não conseguiu complementar via InfoSimples: ${err.message}`);
      }
    }

    if (resultado) {
      resultado.origemApi = resultado.origemApi || 'tjmg';
      await cacheSet(cacheKey, resultado, 1800); // cache 30min
    }

    return resultado;
  }

  // ═══════════════════════════════════════════════════════
  //  Verificar movimentações (monitoramento)
  //  Busca TODAS as movimentações e filtra por data depois
  // ═══════════════════════════════════════════════════════
  async verificarMovimentacoes(numeroCnj, tribunal = 'TJMG', ultimaData) {
    const rawDigits = numeroCnj.replace(/\D/g, '');
    logger.info(`TJMG Provider: verificando movimentações de ${_formatarCNJ(numeroCnj)}...`);

    let todasMovimentacoes = [];

    // ── Fonte 1: InfoSimples (mais completo e atualizado) ──
    if (this._infoSimplesDisponivel) {
      try {
        const movs = await this._buscarMovimentacoesInfoSimples(numeroCnj, 'tjmg');
        if (movs.length > 0) {
          todasMovimentacoes = movs;
          logger.info(`TJMG Provider: ${movs.length} movimentação(ões) obtidas do InfoSimples`);
        }
      } catch (err) {
        logger.warn(`TJMG Provider: erro InfoSimples movimentações: ${err.message}`);
      }
    }

    // ── Fonte 2: DataJud (complemento) ─────────────────
    try {
      const movsDatajud = await datajudService.verificarMovimentacoes(numeroCnj, 'TJMG', null);
      if (movsDatajud.length > 0) {
        const hashesExistentes = new Set(todasMovimentacoes.map(m => m.hashExterno));
        let adicionadas = 0;
        for (const m of movsDatajud) {
          if (!hashesExistentes.has(m.hashExterno)) {
            todasMovimentacoes.push(m);
            hashesExistentes.add(m.hashExterno);
            adicionadas++;
          }
        }
        if (adicionadas > 0) {
          logger.info(`TJMG Provider: +${adicionadas} movimentação(ões) complementares do DataJud`);
        }
      }
    } catch (err) {
      logger.warn(`TJMG Provider: fallback DataJud erro: ${err.message}`);
    }

    // Filtra por data SOMENTE no final
    if (ultimaData) {
      const antes = todasMovimentacoes.length;
      todasMovimentacoes = todasMovimentacoes.filter(m => new Date(m.data) > ultimaData);
      logger.debug(`TJMG Provider: filtrado ${antes} → ${todasMovimentacoes.length} após ultimaData`);
    }

    // Ordena por data desc
    todasMovimentacoes.sort((a, b) => new Date(b.data) - new Date(a.data));

    logger.info(`TJMG Provider: ${todasMovimentacoes.length} movimentação(ões) total`);
    return todasMovimentacoes;
  }

  // ═══════════════════════════════════════════════════════
  //  InfoSimples API — Consulta completa
  // ═══════════════════════════════════════════════════════
  async _consultarInfoSimples(numeroCnj, tribunalSlug = 'tjmg') {
    try {
      const rawDigits = numeroCnj.replace(/\D/g, '');
      const numeroFormatado = _formatarCNJ(numeroCnj);

      logger.info(`InfoSimples: consultando ${numeroFormatado} no ${tribunalSlug.toUpperCase()}...`);

      const response = await axios.post(
        `${INFOSIMPLES_BASE}/${tribunalSlug}/processo`,
        new URLSearchParams({
          token: INFOSIMPLES_TOKEN,
          numero_processo: numeroFormatado,
          timeout: '300',
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 120000, // InfoSimples pode levar tempo no scraping
        }
      );

      const body = response.data;

      // Verifica sucesso (code 200 = sucesso na InfoSimples)
      if (!body || (body.code !== 200 && body.code !== undefined)) {
        const errMsg = body?.code_message || body?.errors?.[0] || 'Resposta inválida';
        logger.warn(`InfoSimples: erro ${body?.code} - ${errMsg}`);
        return null;
      }

      // Dados podem vir em body.data (array) ou body.data[0]
      const dados = Array.isArray(body.data) ? body.data[0] : body.data;
      if (!dados) {
        logger.warn('InfoSimples: resposta sem dados');
        return null;
      }

      // Normalizar resposta InfoSimples para formato JuriX
      const resultado = this._normalizarInfoSimples(dados, numeroCnj, rawDigits);
      logger.info(`InfoSimples: sucesso! ${resultado.movimentacoes?.length || 0} movimentações, ${resultado.partes?.length || 0} partes`);

      return resultado;
    } catch (err) {
      if (err.response?.status === 401 || err.response?.data?.code === 601) {
        logger.error('InfoSimples: TOKEN INVÁLIDO! Verifique INFOSIMPLES_TOKEN no .env');
      } else {
        logger.warn(`InfoSimples: erro na consulta: ${err.message}`);
      }
      return null;
    }
  }

  // ─── Buscar apenas movimentações via InfoSimples ────────
  async _buscarMovimentacoesInfoSimples(numeroCnj, tribunalSlug = 'tjmg') {
    const rawDigits = numeroCnj.replace(/\D/g, '');
    const cacheKey = `tjmg:movs:${rawDigits}`;

    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const resultado = await this._consultarInfoSimples(numeroCnj, tribunalSlug);
    if (!resultado || !resultado.movimentacoes?.length) return [];

    const movs = resultado.movimentacoes.map(m => ({
      data: new Date(m.data),
      descricao: m.descricao?.slice(0, 500) || 'Movimentação',
      tipo: m.tipo || null,
      origemApi: 'tjmg',
      hashExterno: m.hashExterno || _gerarHash('tjmg', rawDigits, m.data, m.descricao),
    }));

    await cacheSet(cacheKey, movs, 1800); // cache 30min
    return movs;
  }

  // ═══════════════════════════════════════════════════════
  //  Normalizar resposta InfoSimples → formato JuriX
  // ═══════════════════════════════════════════════════════
  _normalizarInfoSimples(dados, numeroCnj, rawDigits) {
    // ─── Movimentações ───────────────────────────
    const movimentacoes = [];
    const movRaw = dados.movimento_processo || dados.movimentos || dados.movimentacoes || [];

    for (const m of (Array.isArray(movRaw) ? movRaw : [])) {
      // Campos possíveis da InfoSimples
      const dataStr = m.data_hora_movimentacao || m.data_hora || m.data || m.dataHora;
      const descricao = m.descricao || m.movimento || m.nome || m.complemento || '';

      const data = _parseDateBR(dataStr) || _safeDate(dataStr);
      if (!data) continue;

      const descLimpa = descricao.replace(/\s+/g, ' ').trim();
      if (!descLimpa || descLimpa.length < 2) continue;

      movimentacoes.push({
        data,
        descricao: descLimpa.slice(0, 500),
        tipo: m.tipo || m.tipo_movimento || null,
        hashExterno: _gerarHash('tjmg', rawDigits, data, descLimpa),
      });
    }

    // ─── Partes e Advogados ─────────────────────
    // InfoSimples retorna advogados DENTRO do polo_ativo/passivo
    // com campo "oab". Precisamos separar partes de advogados.
    const partes = [];
    const advogados = [];
    const seenPartes = new Set();
    const seenAdvs = new Set();

    const processarPolo = (lista, tipoParte) => {
      if (!Array.isArray(lista)) return;
      for (const p of lista) {
        const nome = (p.nome || p.nome_parte || p.razao_social || '').trim();
        if (!nome || nome.length < 2) continue;

        const oab = p.oab || p.numero_oab || p.inscricao || null;

        // Se tem OAB, é advogado — não é parte
        if (oab && oab.length > 2) {
          if (!seenAdvs.has(nome.toLowerCase())) {
            seenAdvs.add(nome.toLowerCase());
            advogados.push({
              nome,
              numeroDocumentoPrincipal: oab,
              polo: tipoParte === 'AUTOR' ? 'ativo' : 'passivo',
            });
          }
        } else {
          // Sem OAB = parte real
          if (!seenPartes.has(nome.toLowerCase())) {
            seenPartes.add(nome.toLowerCase());
            partes.push({ nome, tipo: tipoParte });
          }
        }

        // Também extrai advogados aninhados (campo advogados/representantes dentro da parte)
        const advs = p.advogados || p.representantes || [];
        for (const a of (Array.isArray(advs) ? advs : [])) {
          const nomeAdv = (a.nome || a.nome_advogado || '').trim();
          const oabAdv = a.oab || a.numero_oab || a.inscricao || null;
          if (nomeAdv && !seenAdvs.has(nomeAdv.toLowerCase())) {
            seenAdvs.add(nomeAdv.toLowerCase());
            advogados.push({
              nome: nomeAdv,
              numeroDocumentoPrincipal: oabAdv,
              polo: tipoParte === 'AUTOR' ? 'ativo' : 'passivo',
            });
          }
        }
      }
    };

    processarPolo(dados.polo_ativo, 'AUTOR');
    processarPolo(dados.polo_passivo, 'REU');

    // Outros interessados (sempre parte TERCEIRO, sem filtro OAB)
    if (Array.isArray(dados.outros_interessados)) {
      for (const p of dados.outros_interessados) {
        const nome = (typeof p === 'string' ? p : (p.nome || p.nome_parte || '')).trim();
        if (nome && nome.length > 2 && !seenPartes.has(nome.toLowerCase())) {
          seenPartes.add(nome.toLowerCase());
          partes.push({ nome, tipo: 'TERCEIRO' });
        }
      }
    }

    // Se polo_ativo/passivo vierem como string (sem campo oab)
    if (typeof dados.polo_ativo === 'string' && dados.polo_ativo.trim()) {
      dados.polo_ativo.split(/[,;]/).forEach(n => {
        const nome = n.trim();
        if (nome.length > 2 && !seenPartes.has(nome.toLowerCase())) {
          seenPartes.add(nome.toLowerCase());
          partes.push({ nome, tipo: 'AUTOR' });
        }
      });
    }
    if (typeof dados.polo_passivo === 'string' && dados.polo_passivo.trim()) {
      dados.polo_passivo.split(/[,;]/).forEach(n => {
        const nome = n.trim();
        if (nome.length > 2 && !seenPartes.has(nome.toLowerCase())) {
          seenPartes.add(nome.toLowerCase());
          partes.push({ nome, tipo: 'REU' });
        }
      });
    }

    // ─── Dados do processo ───────────────────────
    const dataDistribuicao = _parseDateBR(dados.data_distribuicao) || _safeDate(dados.data_distribuicao);

    return {
      numero: dados.numero_processo || numeroCnj,
      numeroCnj: _formatarCNJ(numeroCnj),
      tribunal: 'TJMG',
      vara: dados.orgao_julgador || dados.vara || null,
      classe: dados.classe_judicial || dados.classe || null,
      assunto: dados.assunto || null,
      dataDistribuicao,
      partes,
      advogados,
      movimentacoes,
      origemApi: 'tjmg',
    };
  }

  // ─── Merge movimentações sem duplicatas ────────────────
  _mergeMovimentacoes(existentes, novas, rawDigits) {
    const merged = [...existentes];
    const hashes = new Set(existentes.map(m => m.hashExterno));

    for (const m of novas) {
      const hash = m.hashExterno || _gerarHash('tjmg', rawDigits, m.data, m.descricao);
      if (!hashes.has(hash)) {
        merged.push({ ...m, hashExterno: hash });
        hashes.add(hash);
      }
    }

    return merged.sort((a, b) => new Date(b.data) - new Date(a.data));
  }
}

module.exports = TjmgProvider;
