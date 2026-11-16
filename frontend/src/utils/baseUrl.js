/* ══════════════════════════════════════════════════════════════════
   Caminho base da aplicação.

   No Electron e em desenvolvimento é "/". Publicado na HostGator em
   https://nossosflows.com.br/jurix, é "/jurix/". Qualquer URL montada
   à mão (API, /storage, service worker, favicon) tem que respeitar
   isso — senão, no subdiretório, o navegador pede
   https://nossosflows.com.br/api/... e recebe 404 do site principal.

   `import.meta.env.BASE_URL` é definido pelo Vite a partir de `base`
   no vite.config.js, então não há valor duplicado em lugar nenhum.
   ══════════════════════════════════════════════════════════════════ */

// Sempre com "/" no início e SEM "/" no fim. Na raiz, string vazia.
export const BASE_PATH = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');

// Monta uma URL dentro da aplicação: caminho('/api') → '/jurix/api'
export function caminho(sufixo = '') {
  const s = sufixo.startsWith('/') ? sufixo : `/${sufixo}`;
  return `${BASE_PATH}${s}`;
}

/* URL absoluta de um arquivo servido pelo backend (avatares, logos,
   documentos). O backend devolve caminhos como "/storage/avatars/x.png".

   Em desenvolvimento o frontend roda na porta 3000 e o backend na 3001,
   então a origem precisa ser trocada. Em produção (Electron ou web) é a
   mesma origem, só com o caminho base na frente. */
export function urlDoArquivo(caminhoDoBackend) {
  if (!caminhoDoBackend) return null;
  if (/^https?:/i.test(caminhoDoBackend)) return caminhoDoBackend;

  const origem = window.location.port === '3000'
    ? window.location.origin.replace(':3000', ':3001')
    : window.location.origin;

  const rel = caminhoDoBackend.startsWith('/') ? caminhoDoBackend : `/${caminhoDoBackend}`;

  // Em dev apontamos direto para o backend, que serve /storage na raiz.
  if (window.location.port === '3000') return `${origem}${rel}`;

  return `${origem}${BASE_PATH}${rel}`;
}
