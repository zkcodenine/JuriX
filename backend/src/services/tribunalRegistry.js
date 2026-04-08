// ══════════════════════════════════════════════════════
//  JuriX — Tribunal Registry
//  Registra e gerencia providers de tribunais.
//  Permite extensão fácil: basta criar novo provider
//  e registrá-lo aqui.
//
//  Ordem de prioridade:
//  1. Provider específico do tribunal (ex: TjmgProvider)
//  2. DataJud (fallback genérico para qualquer tribunal)
// ══════════════════════════════════════════════════════
const TjmgProvider = require('./providers/tjmgProvider');
const DatajudProvider = require('./providers/datajudProvider');
const logger = require('../config/logger');

class TribunalRegistry {
  constructor() {
    this.providers = [];
    this.datajudProvider = new DatajudProvider();

    // ─── Registrar providers específicos ──────────────
    // Para adicionar novo tribunal, basta:
    // 1. Criar arquivo em providers/ estendendo BaseTribunalProvider
    // 2. Registrar aqui com this.registrar(new NovoProvider())
    this.registrar(new TjmgProvider());

    // DataJud é o fallback universal (registrado por último)
    this.providers.push(this.datajudProvider);

    logger.info(`📡 TribunalRegistry: ${this.providers.length} provider(s) registrado(s): ${this.providers.map(p => p.codigo).join(', ')}`);
  }

  /**
   * Registrar um novo provider de tribunal.
   * Providers específicos são inseridos antes do DataJud.
   */
  registrar(provider) {
    // Insere antes do DataJud (que é sempre o último)
    const datajudIdx = this.providers.findIndex(p => p.codigo === 'DATAJUD');
    if (datajudIdx >= 0) {
      this.providers.splice(datajudIdx, 0, provider);
    } else {
      this.providers.push(provider);
    }
    logger.info(`📡 TribunalRegistry: provider "${provider.codigo}" (${provider.nome}) registrado`);
  }

  /**
   * Obter o melhor provider para um tribunal.
   * Retorna provider específico se disponível, senão DataJud.
   */
  obterProvider(codigoTribunal) {
    const codigo = codigoTribunal?.toUpperCase();

    // Primeiro tenta provider específico
    for (const provider of this.providers) {
      if (provider.codigo !== 'DATAJUD' && provider.suporta(codigo)) {
        return provider;
      }
    }

    // Fallback para DataJud
    if (this.datajudProvider.suporta(codigo)) {
      return this.datajudProvider;
    }

    return null;
  }

  /**
   * Consultar processo usando o melhor provider disponível.
   * Se o provider específico falhar, tenta DataJud como fallback.
   */
  async consultarProcesso(numeroCnj, tribunal) {
    const provider = this.obterProvider(tribunal);
    if (!provider) {
      logger.warn(`TribunalRegistry: nenhum provider disponível para ${tribunal}`);
      return null;
    }

    logger.info(`TribunalRegistry: consultando ${numeroCnj} via ${provider.codigo}`);
    const resultado = await provider.consultarProcesso(numeroCnj, tribunal);

    // Se provider específico falhou e não é DataJud, tenta DataJud
    if (!resultado && provider.codigo !== 'DATAJUD' && this.datajudProvider.suporta(tribunal)) {
      logger.info(`TribunalRegistry: fallback para DataJud para ${numeroCnj}`);
      return await this.datajudProvider.consultarProcesso(numeroCnj, tribunal);
    }

    return resultado;
  }

  /**
   * Verificar movimentações usando o melhor provider disponível.
   */
  async verificarMovimentacoes(numeroCnj, tribunal, ultimaData) {
    const provider = this.obterProvider(tribunal);
    if (!provider) {
      logger.warn(`TribunalRegistry: nenhum provider disponível para ${tribunal}`);
      return [];
    }

    logger.info(`TribunalRegistry: verificando movimentações ${numeroCnj} via ${provider.codigo}`);
    const movs = await provider.verificarMovimentacoes(numeroCnj, tribunal, ultimaData);

    // Se provider específico retornou vazio e não é DataJud, tenta DataJud
    if ((!movs || movs.length === 0) && provider.codigo !== 'DATAJUD' && this.datajudProvider.suporta(tribunal)) {
      logger.info(`TribunalRegistry: fallback DataJud movimentações para ${numeroCnj}`);
      return await this.datajudProvider.verificarMovimentacoes(numeroCnj, tribunal, ultimaData);
    }

    return movs;
  }

  /**
   * Listar todos os tribunais suportados com providers específicos.
   */
  listarProvidersEspecificos() {
    return this.providers
      .filter(p => p.codigo !== 'DATAJUD')
      .map(p => ({ codigo: p.codigo, nome: p.nome }));
  }

  /**
   * Verificar se um tribunal tem provider específico (não DataJud).
   */
  temProviderEspecifico(codigoTribunal) {
    const codigo = codigoTribunal?.toUpperCase();
    return this.providers.some(p => p.codigo !== 'DATAJUD' && p.suporta(codigo));
  }
}

// Singleton — mesma instância para toda a aplicação
const registry = new TribunalRegistry();
module.exports = registry;
