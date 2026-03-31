// ══════════════════════════════════════════════════════
//  JuriX — DataJud Provider (genérico)
//  Wrapper em torno do datajudService existente,
//  implementando a interface BaseTribunalProvider.
//  Funciona como fallback para qualquer tribunal
//  que tenha índice no DataJud.
// ══════════════════════════════════════════════════════
const BaseTribunalProvider = require('./baseTribunalProvider');
const datajudService = require('../datajudService');
const logger = require('../../config/logger');

class DatajudProvider extends BaseTribunalProvider {
  constructor() {
    super('DATAJUD', 'DataJud (CNJ)');
  }

  /**
   * DataJud suporta qualquer tribunal que tenha índice mapeado.
   */
  suporta(codigoTribunal) {
    return !!datajudService.TRIBUNAL_INDEX[codigoTribunal?.toUpperCase()];
  }

  async consultarProcesso(numeroCnj, tribunal) {
    try {
      const resultado = await datajudService.consultarProcesso(numeroCnj, tribunal);
      if (resultado) resultado.origemApi = 'datajud';
      return resultado;
    } catch (err) {
      logger.error(`DatajudProvider.consultarProcesso erro: ${err.message}`);
      return null;
    }
  }

  async verificarMovimentacoes(numeroCnj, tribunal, ultimaData) {
    try {
      return await datajudService.verificarMovimentacoes(numeroCnj, tribunal, ultimaData);
    } catch (err) {
      logger.error(`DatajudProvider.verificarMovimentacoes erro: ${err.message}`);
      return [];
    }
  }
}

module.exports = DatajudProvider;
