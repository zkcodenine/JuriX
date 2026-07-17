# Plano — Admin, Unidades, Compartilhamento e Chat

Documento de planejamento. Nada aqui foi implementado ainda.
Levantado em 16/jul/2026 sobre a v3.0.11.

## Decisões já tomadas

> **Situação (16/jul/2026):** o cPanel da HostGator **não tem Node.js** (plano
> compartilhado, só PHP), então a API não pode rodar lá. Decisão: **adiar o
> servidor**. Escopo atual = **Fase 1**. As Fases 0, 2 e 3 ficam registradas
> aqui para quando houver servidor.

| Assunto | Decisão |
|---|---|
| Onde roda o backend | **Adiado.** cPanel sem Node; continua no cliente por ora |
| Chat em tempo real | **Polling** (WebSocket é luxo, não requisito) |
| Compartilhar processo | Nível **escolhido por compartilhamento**: leitura ou edição |
| Unidade por usuário | **Uma só** |
| Admin | **Papel atribuível** (não conta fixa no código) |
| Login | Aceita **CPF ou e-mail** |
| E-mail | Continua no cadastro, como **contato** |
| Reset de senha | **Admin define** a senha |

## Ponto de partida (medido, não estimado)

- **4 usuários, 2 processos, 0 documentos** no banco. O raio de impacto de mudanças estruturais é praticamente zero hoje — essa janela não volta.
- O isolamento de dados hoje é `usuarioId: req.usuario.id`, repetido em **~78 lugares**: `processosController` (42), `agendaController` (8), `routes/configuracoes` (9), `routes/tarefas` (8), `routes/documentos` (5), `routes/honorarios` (5).
- **Nem todos os 78 mudam.** Agenda e configurações são do usuário e continuam privadas. Só muda o que diz respeito a *processo*. A classificação um a um é parte da Fase 2.
- O app **já depende de internet** (MySQL remoto na HostGator). Tirar o backend do cliente não custa offline — ele não existe hoje, além do cache de leitura em `services/api.js`.

## Fase 0 — Backend para o servidor (ADIADA — cPanel sem Node)

Sem isto, três dos cinco itens pedidos não funcionam de verdade.

**Por que foi adiada:** o cPanel do plano atual não oferece "Setup Node.js App"
(hospedagem compartilhada, só PHP). As alternativas levantadas foram VPS
(HostGator, ~mesmo fornecedor; ou Hostinger/Contabo, mais barato) e PaaS
(Railway/Render, exige storage externo por causa do disco efêmero). Nenhuma foi
adotada por ora.

**Nota importante para quando isto voltar à mesa:** não é preciso migrar o
MySQL junto. Hoje cada cliente atravessa a internet doméstica até o banco da
HostGator; uma API em datacenter falando com esse mesmo banco já fica **melhor
que hoje**. Dá para mover só a API.

**Correção de escopo (registrada para não se perder):** compartilhamento de
processo e chat de **texto** funcionariam sem servidor, via o MySQL comum +
polling. Só a parte de **arquivo** (documentos e anexos) é que não funciona.
Adiar 2 e 3 mesmo assim é deliberado: o que o advogado mais quer compartilhar é
o PDF, e um compartilhamento onde o colega vê a lista e recebe "arquivo não
encontrado" é pior do que não ter.

**Por que é pré-requisito:**
- **Documentos e anexos:** hoje o upload grava em disco local (`storage/documentos/<usuarioId>`). Compartilhar um processo mostraria o documento na lista do outro usuário e daria "Arquivo não encontrado no disco" — o PDF está no PC de quem subiu.
- **Permissões:** todo instalador embarca o `.env` com usuário e senha do MySQL de produção. Qualquer usuário escreve direto na tabela e ignora qualquer regra da tela. "Quem não é admin não edita a unidade" só vale de verdade quando o banco deixar de ser acessível pelo cliente.
- **Chat:** sem servidor não há canal comum.

**O que ganha de brinde:** acaba o "Backend não respondeu após 45 segundos" (não há backend local para subir), o `.env` sai do instalador, e as queries ficam mais rápidas (banco ao lado do backend, em vez de cada cliente atravessando a internet).

**O que muda:**
- Backend passa a rodar no cPanel; o Electron vira cliente leve apontando para a URL pública (HTTPS obrigatório — hoje o tráfego inclui senha no login).
- `electron/main.js`: remove `utilityProcess.fork`, o poll de `/health` e o `killPortIfBusy`.
- `package.json`: remove `backend` do `extraResources` — **é isso que tira as credenciais das máquinas dos clientes**.
- CORS liberado para a origem do app.
- Trocar `JWT_SECRET` (ainda é o placeholder `jurix_dev_secret_troque_em_producao_12345678`) e a senha do MySQL, que hoje estão espalhadas nos PCs dos clientes. Trocar o JWT desloga todo mundo uma vez — combinar o momento.
- `documentos.js`: corrigir o caminho de gravação (hoje ignora `STORAGE_PATH` e grava dentro da pasta de instalação, que o instalador apaga a cada update — bug latente, ainda sem vítima porque não há documentos).

**A verificar antes de escrever código:** se o cPanel tem "Setup Node.js App" e qual versão do Node. Hospedagem compartilhada costuma derrubar processo Node ocioso e barrar WebSocket. Consequência aceita: chat por polling. Consequência a medir: se a API "dormir", o primeiro acesso do dia fica lento — e agora **se o servidor cair, ninguém trabalha**, o que é diferente de hoje.

## Fase 1 — Admin, unidades, usuários, login por CPF  ← **ESCOPO ATUAL**

Aditiva: os defaults preservam o comportamento atual.

> **Limite honesto desta fase sem servidor:** as permissões são **cerca de
> proteção, não segurança**. Todo instalador embarca o `.env` com a senha do
> MySQL, então qualquer usuário pode editar a tabela direto e ignorar as regras
> da tela. Aceitável entre colegas de confiança; não substitui a Fase 0.

```prisma
enum PerfilUsuario { USUARIO  ADMIN_UNIDADE  ADMIN_GLOBAL }

model Unidade {
  id        String   @id @default(uuid())
  nome      String
  cnpj      String?
  endereco  String?
  telefone  String?
  email     String?
  ativo     Boolean  @default(true)
  usuarios  Usuario[]
  @@map("unidades")
}

model Usuario {
  // ... campos atuais preservados
  cpf         String?       @unique   // opcional: os 4 atuais ficam sem
  perfil      PerfilUsuario @default(USUARIO)
  unidadeId   String?
  ultimoLogin DateTime?
}
```

- **Login por CPF ou e-mail:** o campo aceita os dois. Se o texto digitado tem 11 dígitos, busca por CPF; senão, por e-mail. Ninguém fica trancado na virada, e o `jurixadmin@gmail.com` continua entrando por e-mail como pedido.
- **`jurixadmin`** criado por script com `bcrypt.hash(senha, 12)` e `perfil = ADMIN_GLOBAL`. **Nunca inserir usuário direto na tabela** — foi exatamente isso que quebrou o login em 16/jul (senha em texto puro → `bcrypt.compare` sempre falso → o bug só aparece quando a pessoa clica em "Sair").
- **Reset:** admin define a senha, gravada com `bcrypt.hash`. Fica registrado que o admin conhece a senha do usuário — se um dia isso incomodar, o caminho é senha temporária com troca obrigatória.
- **Permissão de unidade:** só `ADMIN_UNIDADE` da própria unidade (ou `ADMIN_GLOBAL`) edita os dados da unidade. Checagem no backend, não só escondendo o botão.
- **Item na barra lateral** visível apenas para `ADMIN_GLOBAL`.

**Impacto no uso atual:** nenhum. Usuários existentes viram `USUARIO`, sem unidade, e seguem entrando por e-mail.

## Fase 2 — Compartilhar processo (a parte arriscada)

```prisma
enum NivelCompartilhamento { LEITURA  EDICAO }

model ProcessoCompartilhado {
  id         String   @id @default(uuid())
  processoId String
  usuarioId  String                     // com quem foi compartilhado
  nivel      NivelCompartilhamento @default(LEITURA)
  criadoPor  String                     // quem compartilhou
  criadoEm   DateTime @default(now())
  @@unique([processoId, usuarioId])
  @@index([usuarioId])
  @@map("processos_compartilhados")
}
```

Um helper central substitui o filtro de dono:

```js
// leitura: sou dono OU alguém compartilhou comigo
const whereProcessoAcessivel = (usuarioId) => ({
  OR: [
    { usuarioId },
    { compartilhamentos: { some: { usuarioId } } },
  ],
});

// escrita: sou dono OU tenho compartilhamento de EDICAO
// exclusão e novo compartilhamento: somente o dono
```

**Por que é o item arriscado:** é aqui que um erro vaza processo de um cliente para outro — o pior defeito possível num sistema jurídico. Mitigação:
1. Nada nasce compartilhado, então o `OR` com a tabela vazia devolve exatamente o mesmo conjunto de hoje.
2. Escrever **antes** um teste automatizado que prove o isolamento (usuário A não enxerga nada de B) e rodá-lo a cada mudança.
3. Classificar os ~78 filtros um a um: agenda e configurações continuam privadas; só o que é processo passa pelo helper.

**Botão "compartilhar com":** lista os usuários da mesma unidade (exceto o dono). Só aparece se o usuário tiver unidade.

**Em aberto:** o compartilhamento sobrevive se o usuário mudar de unidade? (Sugestão: sim, mas o admin vê e pode revogar.)

## Fase 3 — Chat de discussão no processo

```prisma
model MensagemProcesso {
  id           String   @id @default(uuid())
  processoId   String
  usuarioId    String                 // autor
  texto        String?  @db.Text
  anexo        String?                // caminho no servidor
  anexoNome    String?
  anexoMime    String?
  anexoTamanho Int?
  criadoEm     DateTime @default(now())
  @@index([processoId, criadoEm])
  @@map("mensagens_processo")
}
```

- Visível para quem tem acesso ao processo (dono + compartilhados), incluindo nível LEITURA — ler o processo e poder discutir sobre ele.
- **Polling** (decidido): atualiza a cada poucos segundos. Se o cPanel permitir WebSocket, dá para trocar depois sem mexer no modelo.
- Anexos usam o mesmo storage do servidor da Fase 0.

**Em aberto:** dá para apagar/editar mensagem? (Sugestão: autor apaga a própria; fica "mensagem removida".)

## ~~Correção do storage~~ — FEITO na v3.0.12 (17/jul/2026)

> Corrigido e verificado no app empacotado, nos dois sentidos: documento
> gravado pelo código antigo foi **destruído** por um update real; documento
> gravado pelo código novo **sobreviveu** a um update real, com conteúdo
> intacto. Base única agora em `backend/src/config/storage.js`.

O problema original, para registro:

`routes/documentos.js` grava o upload em
`path.join(__dirname, '../../../storage/documentos', usuarioId)`, ou seja,
**dentro da pasta de instalação** — que o instalador apaga (`RMDir /r $INSTDIR`)
a cada auto-update forçado. **O primeiro documento que alguém subir some no
próximo update.** Hoje há 0 documentos no banco, então ainda não houve vítima.

Conserto: gravar em `process.env.STORAGE_PATH` (o Electron já aponta para
`userData/storage`, que sobrevive aos updates). Mesma classe de bug do
`logger.js`, que ignorava `LOG_PATH` — já corrigido na v3.0.9.

## Ordem e riscos

| Fase | Risco | Observação |
|---|---|---|
| ~~Storage~~ | — | **Feito na v3.0.12.** |
| 1 — Admin/unidades/CPF | Baixo | **Escopo atual.** Aditivo, defaults preservam tudo. |
| 0 — Servidor | **Alto** | Adiada (cPanel sem Node). Destrava 2 e 3, e mata o `.env` no instalador. |
| 2 — Compartilhamento | **Alto** | ~78 filtros. Exige teste de isolamento. Depende da 0 para ser útil. |
| 3 — Chat | Médio | Texto roda sem servidor; anexos dependem da 0. |

## Pendências

1. ~~**Fase 1:** confirmar se o `jurixadmin` terá unidade ou fica acima de todas.~~
   **Decidido:** `ADMIN_GLOBAL` fica **acima de todas as unidades** (sem vínculo,
   enxerga todos os escritórios).
2. **Quando houver servidor:** escolher VPS ou PaaS; definir URL pública e HTTPS;
   combinar quando trocar `JWT_SECRET` e a senha do MySQL (desloga todos uma vez).
