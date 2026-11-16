# 🧪 Testes de regressão do JuriX

Garantem que o que já funcionava continua funcionando. Rodam contra a API de
verdade (HTTP), sem mock de banco — é lá, no Prisma e nos middlewares de acesso,
que os defeitos deste sistema moram.

```bash
cd backend
npm test
```

## Comandos

| Comando | Para quê |
|---|---|
| `npm test` | roda tudo (use antes de qualquer build ou publicação) |
| `node testes/executar.js agenda planos` | só essas suítes, durante o desenvolvimento |
| `node testes/executar.js --listar` | lista as suítes |
| `node testes/executar.js --base https://nossosflows.com.br/jurix/api` | valida o servidor publicado |

Sai com código **1** se algo falhar — serve direto em CI ou num hook de pré-build.

## Como funciona

- O executor sobe o Express **em memória**, numa porta escolhida pelo SO. Não
  conflita com o app aberto nem com outra execução em paralelo.
- Cada suíte recebe uma `marca` única e cria os próprios dados com a `fabrica`.
  No fim — **mesmo se a suíte quebrar no meio** — tudo é apagado.
- O banco usado é o de `backend/.env`. O executor imprime o host no topo:
  confira antes de rodar.

## Suítes

| Arquivo | O que protege |
|---|---|
| `auth.suite.js` | login, token, conta desativada e **senha sempre em bcrypt** |
| `isolamento.suite.js` | processo de um escritório não vaza para outro; níveis de compartilhamento |
| `processos.suite.js` | CRUD e busca por número, tipo de ação, parte, assunto, tribunal e vara |
| `tarefas.suite.js` | CRUD, subtarefas, vínculo com processo, filtros |
| `agenda.suite.js` | etiquetas e eventos; excluir etiqueta **não** apaga compromisso |
| `planos.suite.js` | cota de 5 processos, plano vencido, modo somente-leitura acima da cota |
| `admin.suite.js` | perfis, unidades, reset de senha, nunca ficar sem administrador |
| `google-agenda.suite.js` | falha do Google nunca derruba cadastro; toda ação continua ligada à agenda |

## Escrevendo uma suíte nova

Crie `suites/<area>.suite.js` — o executor carrega sozinho:

```js
module.exports = {
  nome: 'Nome no relatório',
  precisaDeBanco: true,
  async executar({ t, req, fabrica, prisma, marca }) {
    const dono = await fabrica.usuario('area_dono');

    const r = await req('POST', '/minha-rota', dono.token, { campo: 'x' });
    t.status('cria o registro → 201', r, 201);
    t.checar('a regra de negócio em palavras', r.dados?.campo === 'x');

    const outro = await fabrica.usuario('area_outro');
    t.status('não vaza para outro usuário → 404',
      await req('GET', `/minha-rota/${r.dados.id}`, outro.token), 404);
  },
};
```

### O que o contexto entrega

| | |
|---|---|
| `t.status(desc, resposta, esperado)` | confere o status HTTP (aceita array) |
| `t.checar(desc, condicao, detalhe)` | asserção livre |
| `t.igual(desc, recebido, esperado)` | compara por JSON |
| `t.pular(desc, motivo)` | marca como pulado (ambiente não permite) |
| `req(metodo, caminho, token, corpo)` | cliente HTTP da API |
| `fabrica.usuario(apelido, extras)` | cria e já loga; `extras` sobrescreve plano, perfil, unidade |
| `fabrica.unidade(nome)` / `fabrica.processo(token, dados)` | descartáveis, limpos no fim |
| `prisma` | para montar cenários que a API (corretamente) não permitiria |
| `marca` | prefixo único desta execução |

### Regras

1. **Zero dados fixos.** Sempre pela `fabrica`, senão o banco acumula lixo.
2. **Descrição diz a regra**, não a rota: "parcela paga não fica com lembrete
   pendurado", não "testa PUT /parcelas".
3. **Cubra o caminho errado**: sem token, de outro usuário, sem campo
   obrigatório, acima da cota.
4. **Isolamento é obrigatório** em qualquer área que guarde dado de cliente.

## Limites conhecidos

- Cobrem a **API**. Tela, Electron e a chamada real ao Google ficam de fora.
  Para o Google, o que existe é: (a) toda ação continua funcionando com ele
  indisponível e (b) verificação de que cada ação ainda chama o serviço.
- Precisam do banco de `backend/.env` acessível.
