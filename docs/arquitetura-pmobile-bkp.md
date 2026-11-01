# PMobile — Arquitetura e contratos (BKP)

Atualizado com a arquitetura modular da área **Dados locais**. Documento de referência técnica, não uma declaração de que todos os fluxos foram validados em aparelho.

## 1. Fronteiras e fontes de dados

```text
PC / Android (HTML + CSS + JavaScript no WebView)
  ├─ Aplicativo original (Pesquisa, Contagem manual, Reservas, Rastreio etc.)
  │     ├─ IndexedDB: cache local do inventário original para consulta offline
  │     └─ Supabase: tabelas/RPCs do fluxo original (Dogo e logística)
  └─ Dados locais (hub + 8 módulos independentes)
        └─ dados-locais.js (coordenador / navegação / RPC)
              └─ RPCs pmobile_local_* autenticadas no Supabase
                    ├─ pmobile_local_materiais (catálogo independente)
                    ├─ pmobile_local_conferencias (histórico independente)
                    └─ pmobile_local_comparar (leitura Dogo × local)
```

**Invariantes obrigatórios**
- A consulta de Dados locais nunca deve alterar a tabela original `materiais`.
- O frontend de Dados locais só acessa funções `pmobile_local_*`; operações da Dogo permanecem sob seus próprios módulos.
- Campos `NULL` de quantidade/local indicam ausência de contagem e não devem ser convertidos silenciosamente em zero.
- A criação inicial de senha segue o procedimento administrativo existente e está fora do escopo desta refatoração.
- Dados locais requerem conexão com Supabase nesta versão; o cache offline da Dogo não concede operação offline equivalente ao catálogo local.

## 2. Responsabilidades por módulo

| Arquivo | Responsabilidade | Contrato obrigatório |
|---|---|---|
| `dados-locais/pesquisa-local.js` | Pesquisa e cards de materiais | `form, render` |
| `dados-locais/estoque-local.js` | Alteração de quantidade, reservas, local | `selecionar, quantidade, salvarEstoque, template` |
| `dados-locais/reservas-local.js` | Lista de reservas e paginação | `form, render, template` |
| `dados-locais/conferencias-local.js` | Registro e histórico de conferências | `selecionarConferencia, registrarConferencia, listarConferencias, template` |
| `dados-locais/comparar-verificar.js` | Formulário e resumo de comparação | `form, atualizarResumo, template` |
| `dados-locais/divergencias-local.js` | Cards de faltas, sobras, reservas divergentes | `render, template` |
| `dados-locais/locais-local.js` | Mudança de local: anterior e novo | `render, template` |
| `dados-locais/importacao-local.js` | Leitura de planilha, lotes, checkpoint e retomada | `importar, template` |

O coordenador não deve voltar a absorver as rotinas específicas. Cada fábrica recebe um contexto imutável, declarando somente as dependências utilizadas. Os contratos são verificados antes de expor a navegação.

Se um módulo estiver ausente/incompleto, **Dados locais não devem tentar operar parcialmente**: o acesso mostra aviso de atualização, preservando as telas originais. Em particular, falha de um módulo não deve realizar escrita no Supabase nem interromper o restante do PMobile.

## 3. Navegação, requisições e sincronização

```text
Clique no hub Dados locais
  ↓
Coordenador seleciona aba
  ↓
Módulo constrói formulário e recebe eventos
  ↓
Coordenador consulta RPC pmobile_local_*
  ↓
Fila de consultas por aba mantém somente a intenção mais recente
  ↓
Resposta atual renderizada pelo módulo
```

As páginas de comparação também fazem atualização periódica somente quando visíveis. O controle de concorrência impede que respostas antigas sobrescrevam uma busca ou paginação mais recente.

No comparador, `pmobile_local_comparar` reúne as duas fontes, sem criar registros, e retorna indicadores de diferença versus pendência.

## 4. Web, Android e OTA

- `index.html` carrega os oito módulos antes de `dados-locais.js`.
- `www/` replica o frontend para os assets empacotados no APK.
- O pipeline OTA empacota arquivos da raiz e **não** utiliza `www/` para o ZIP.
- Mudanças de JavaScript devem atualizar os query parameters de cache dos scripts no HTML.
- Uma atualização OTA exige bundle íntegro, manifesto e procedimento de ativação; sucesso no GitHub Actions não substitui teste em aparelho.

## 5. Matriz de validação arquitetural

| Camada | Verificação |
|---|---|
| JavaScript | `node --check dados-locais.js` e arquivos de `dados-locais/` |
| Contratos | `node --test tests/dados-locais-arquitetura.test.cjs` |
| Fluxos e regressões | `node --test tests/*.test.cjs` |
| CSS e estrutura nativa | GitHub Actions em Chrome headless, larguras 360/390/430 |
| Empacotamento | Testes de OTA e igualdade de arquivos raiz/`www/` |
| Supabase | RPCs autorizadas e contagens das duas bases antes/depois |
| Android real | Login, pesquisa, navegação, falha de conexão, atualização, retomada, reinício e integridade pós-OTA |

**Não atestar 95%+ pelo BKP sem evidência dos fluxos em aparelho Android**; a existência da arquitetura e o sucesso do CI cobrem apenas parte dos critérios.

## 6. Riscos conhecidos ainda fora desta mudança

- CSS nativo possui duplicação de seletores e cascata, sujeita a diferenças visuais.
- O frontend completo carrega vários scripts e estilos antes do uso de módulos específicos.
- A persistência de sessão e os controles de outras RPCs demandam auditoria própria; nenhuma alteração de senha, usuário ou privilégios foi feita aqui.
- Dados locais ainda dependem de Supabase online; o comportamento de uso offline deste módulo não foi implementado.
- Rotinas de importação temporária e limpeza de histórico demandam ciclo separado, sem exclusão automática de registros.
