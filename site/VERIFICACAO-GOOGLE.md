# ✅ Verificação do app no Google — passo a passo (remove o aviso "app não verificado")

Este guia usa as 3 páginas prontas nesta pasta (`index.html`, `privacidade.html`, `termos.html`).
Ao concluir, o aviso de "app não verificado" **deixa de aparecer** para todos os usuários.

---

## 0️⃣ Domínio usado

- **Domínio de hospedagem/verificação:** `jurix.com.br` (é onde as páginas ficarão e o que será
  verificado no Google).
- **E-mail de contato:** `contato@jurix.com.br` (já configurado nas páginas).

> ✅ `jurix.com.br` é o domínio ideal: casa com o nome do app e com o e-mail de contato, então o revisor
> do Google não terá o que questionar sobre coerência de marca.
>
> As URLs abaixo assumem hospedagem na **raiz** do `jurix.com.br`.

---

## 1️⃣ Hospedar as 3 páginas na HostGator

1. cPanel → **Gerenciador de Arquivos** → pasta `public_html` (ou a pasta do seu domínio).
2. Faça upload de: `index.html`, `privacidade.html`, `termos.html` (estão em `site/`).
3. Teste no navegador:
   - `https://jurix.com.br/` → página inicial
   - `https://jurix.com.br/privacidade.html` → política de privacidade
   - `https://jurix.com.br/termos.html` → termos

---

## 2️⃣ Verificar o domínio no Google Search Console

1. Acesse [search.google.com/search-console](https://search.google.com/search-console).
2. Adicionar propriedade → **Prefixo do URL** → `https://jurix.com.br/`.
3. Método de verificação: **arquivo HTML** (baixe e suba na `public_html`) ou **tag HTML** (colar no `<head>` do `index.html`).
4. Clique em **Verificar**. Use a **mesma conta Google** dona do projeto no Google Cloud.

---

## 3️⃣ Preencher a Tela de Consentimento OAuth

Google Cloud Console → **APIs e serviços → Tela de permissão OAuth**:

| Campo | Valor |
|---|---|
| Nome do app | `JuriX` |
| E-mail de suporte | seu e-mail |
| Logotipo | PNG 120×120 do JuriX (opcional, mas recomendado) |
| **Página inicial** | `https://jurix.com.br/` |
| **Política de privacidade** | `https://jurix.com.br/privacidade.html` |
| **Termos de serviço** | `https://jurix.com.br/termos.html` |
| **Domínios autorizados** | `jurix.com.br` |
| E-mail do desenvolvedor | seu e-mail |

---

## 4️⃣ Conferir os escopos

Em **Escopos**, deve constar apenas:
- `.../auth/calendar.events` (sensível — é o que exige verificação)
- `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` (não sensíveis)

Não adicione escopos que o app não usa (quanto menos, mais rápida a aprovação).

---

## 5️⃣ Publicar o app

Na Tela de Consentimento → botão **"PUBLICAR APP"** → confirmar (status muda de *Testing* para *Em produção*).

> Só de publicar, o token deixa de expirar em 7 dias. O aviso ainda aparece até a verificação ser aprovada (passo 6).

---

## 6️⃣ Enviar para verificação

Após publicar, aparece **"Preparar para verificação"**. Preencha e envie. Vão pedir:

- **Justificativa do escopo `calendar.events`** — cole o texto abaixo.
- **Vídeo de demonstração** (link do YouTube, pode ser "não listado"): uma gravação de tela curta mostrando:
  1. o usuário clicando em "Conectar Google Agenda" no JuriX;
  2. a tela de consentimento do Google (com os escopos);
  3. o app criando um evento que aparece na Google Agenda.

### 📋 Texto de justificativa (copie e cole)

> O JuriX é um software de gestão jurídica para advogados. Utilizamos o escopo
> `https://www.googleapis.com/auth/calendar.events` exclusivamente para criar, atualizar e excluir,
> na agenda do próprio usuário, os eventos e prazos processuais que ele cadastra dentro do JuriX.
> O objetivo é permitir que o advogado receba, no seu celular e na sua Google Agenda, lembretes
> dos seus compromissos e prazos. Não lemos eventos de terceiros, não usamos os dados para
> publicidade, não vendemos nem compartilhamos esses dados. O acesso é iniciado e revogável pelo
> próprio usuário, e o uso segue a Política de Dados do Usuário dos Serviços de API do Google,
> incluindo os requisitos de Uso Limitado.

---

## ⏳ Depois de enviar

- O Google revisa (normalmente de alguns dias a algumas semanas para escopo sensível).
- Podem pedir ajustes (ex.: link da privacidade não acessível, domínio não verificado) — é só corrigir e reenviar.
- **Aprovado:** o aviso "app não verificado" some para todos os usuários. 🎉

---

## Enquanto não é aprovado
Continua funcionando normalmente clicando em **"Avançado → Acessar JuriX"**. Só os e-mails na lista de
"Usuários de teste" conseguem conectar até a publicação; após publicar (passo 5), qualquer usuário consegue
(com o aviso, até a verificação sair).
