// ══════════════════════════════════════════════════════
//  JuriX — Base Tribunal Provider
//  Classe base para integrações com tribunais.
//  Cada tribunal pode ter um provider específico
//  que estende esta classe.
// ══════════════════════════════════════════════════════

class BaseTribunalProvider {
  /**
   * @param {string} codigo — Código do tribunal (ex: 'TJMG', 'TJSP')
   * @param {string} nome   — Nome legível (ex: 'Tribunal de Justiça de Minas Gerais')
   */
  constructor(codigo, nome) {
    this.codigo = codigo;
    this.nome = nome;
  }

  /**
   * Consultar processo completo por número CNJ.
   * Deve retornar objeto normalizado:
   * {
   *   numero, numeroCnj, tribunal, vara, classe, assunto,
   *   dataDistribuicao, partes: [{nome, tipo}],
   *   advogados: [{nome, numeroDocumentoPrincipal, polo}],
   *   movimentacoes: [{data, descricao, tipo, hashExterno}],
   *   origemApi: string
   * }
   * @param {string} numeroCnj
   * @returns {Promise<object|null>}
   */
  async consultarProcesso(numeroCnj) {
    throw new Error(`${this.codigo}: consultarProcesso() não implementado`);
  }

  /**
   * Verificar novas movimentações desde a última data.
   * Deve retornar array de movimentações normalizadas:
   * [{data, descricao, tipo, origemApi, hashExterno}]
   * @param {string} numeroCnj
   * @param {Date|null} ultimaData
   * @returns {Promise<Array>}
   */
  async verificarMovimentacoes(numeroCnj, ultimaData) {
    throw new Error(`${this.codigo}: verificarMovimentacoes() não implementado`);
  }

  /**
   * Retorna se este provider suporta o tribunal dado.
   * @param {string} codigoTribunal
   * @returns {boolean}
   */
  suporta(codigoTribunal) {
    return codigoTribunal?.toUpperCase() === this.codigo;
  }
}

module.exports = BaseTribunalProvider;
