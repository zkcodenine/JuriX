const path = require('path');

// Raiz do projeto (dev) / da pasta resources (app empacotado).
const RAIZ = path.join(__dirname, '..', '..', '..');

// Onde ficam avatars, logos e documentos.
//
// O Electron passa STORAGE_PATH apontando para userData — que SOBREVIVE aos
// updates. Sem ele, o fallback é <projeto>/storage, usado em dev.
//
// Isto existe porque a regra estava copiada em três lugares com resultados
// diferentes: `app.js` e o avatar liam STORAGE_PATH, mas `routes/documentos.js`
// gravava em <resources>/storage/documentos — dentro da pasta de instalação,
// que o instalador apaga (RMDir /r $INSTDIR) a cada auto-update forçado. Ou
// seja, o upload ia para um lugar que o app servia de outro, e sumia no update
// seguinte.
//
// path.resolve devolve STORAGE_PATH intacto quando ele é absoluto (Electron) e
// resolve relativo contra a RAIZ quando não é (o `./storage` do .env de dev) —
// em vez de contra o CWD, que muda conforme de onde o processo foi iniciado.
const STORAGE_DIR = path.resolve(RAIZ, process.env.STORAGE_PATH || 'storage');

// Converte o caminho gravado no banco ("/storage/documentos/<uid>/<arq>") para
// um caminho absoluto em disco. O prefixo "/storage" é histórico: ele não faz
// parte do disco, porque STORAGE_DIR já é a raiz do storage.
function caminhoDoDocumento(arquivoRelativo) {
  const semPrefixo = String(arquivoRelativo || '').replace(/^[\\/]*storage[\\/]+/i, '');
  const absoluto = path.resolve(STORAGE_DIR, semPrefixo);

  // Defesa contra path traversal: nunca sair da pasta de storage.
  if (absoluto !== STORAGE_DIR && !absoluto.startsWith(STORAGE_DIR + path.sep)) {
    return null;
  }
  return absoluto;
}

module.exports = { STORAGE_DIR, caminhoDoDocumento };
