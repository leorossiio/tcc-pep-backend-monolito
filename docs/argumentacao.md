# Avaliação de Capacidade e Limites de Sustentação da Arquitetura Monolítica sob Estresse

**Seção Experimental — Avaliação Quantitativa do Comportamento da Arquitetura Monolítica**

Contexto: Monografia de Conclusão de Curso (TCC) — Engenharia de Software / Persistência Poliglota
Status da infraestrutura: ambiente local conteinerizado (Docker) com recursos restritos

Este documento consolida a argumentação técnica e as evidências empíricas coletadas na bateria de testes de carga executada sobre a arquitetura **monolítica** do sistema de Prontuário Eletrônico do Paciente (PEP). O objetivo é caracterizar o comportamento do sistema conforme a concorrência escala, identificando o ponto de degradação ("joelho da curva") e correlacionando-o às restrições de hardware impostas.

> **Nota metodológica.** Todos os números deste documento foram extraídos diretamente dos arquivos de resultado gerados pelo k6 (`k6-scripts/results/*.csv`, consolidados em `consolidado-monolito.csv`). São reproduzíveis: basta reexecutar os cenários descritos na Seção 2.

---

## 1. Dimensionamento da Infraestrutura e Restrições de Hardware

Para simular um cenário controlado de escassez de recursos — reproduzindo ambientes de produção saturados ou mal dimensionados — foram impostos limites estritos de hardware na camada de orquestração (Docker Compose), conforme a matriz abaixo:

| Serviço / Container | Imagem Base | Limite de CPU | Limite de RAM | Parâmetros Críticos |
|---|---|---|---|---|
| `app-monolito` (API NestJS) | Node.js Alpine | 2,0 vCPU | 1,0 GB | `NODE_ENV=production` (event loop single-thread) |
| `postgres-pep` (Relacional) | postgres:15-alpine | 1,0 vCPU | 1,0 GB | `max_connections=100`, `shared_buffers=256MB`, `effective_cache_size=768MB`, `work_mem=4MB` |
| `mongo-pep` (NoSQL Documento) | mongo:6.0 | 1,0 vCPU | 1,0 GB | armazenamento de históricos e laudos |

O parâmetro `max_connections=100` no PostgreSQL atua como o principal delimitador lógico do sistema. No PostgreSQL cada conexão aceita gera um processo dedicado no sistema operacional hospedeiro; o teto de 1,0 GB de RAM no container torna esse limite uma proteção contra colapso por falta de memória. Combinado ao pool de conexões da aplicação, ele estabelece o limite operacional efetivo do backend.

---

## 2. Metodologia de Medição

### 2.1. Esteira transacional (script k6)

Cada Usuário Virtual (VU) simula um profissional de saúde operando o PEP. Em ciclo contínuo, intercalado por pausas regulatórias de `sleep(1s)` (tempo de raciocínio humano), cada VU executa uma esteira de cinco operações de alta complexidade de I/O, doravante referidas como **Joins** — pois cada uma cruza, no nível da aplicação, os dois bancos da persistência poliglota:

| Join | Endpoint | Natureza |
|---|---|---|
| **Join 1** | `POST /atendimentos` | Escrita poli-híbrida (dual-write sequencial) |
| **Join 2** | `GET /atendimentos/:id` | Leitura poliglota (PG + MongoDB em paralelo) |
| **Join 3** | `GET /pacientes/:id/historico-completo` | Leitura poliglota agregada (visão 360°) |
| **Join 4** | `POST /consultas-laudos` | Escrita em MongoDB (+ propagação de alergias) |
| **Join 5** | `GET /medicos/:id/laudos` | Leitura poliglota (PG → MongoDB → PG) |

O **Join 1** é o vetor central de degradação. Trata-se de uma escrita síncrona encadeada em quatro etapas de rede:

1. `INSERT` do atendimento no **PostgreSQL**;
2. `findOneAndUpdate` (upsert atômico) do histórico clínico no **MongoDB**;
3. `INSERT` da triagem inicial (ConsultaLaudo) no **MongoDB**;
4. `INSERT` assíncrono (fire-and-forget) do log de auditoria no **PostgreSQL**.

Por ser sequencial, a operação mantém uma conexão do pool retida durante todo o tráfego de rede entre a aplicação e os dois bancos, expondo a arquitetura ao enfileiramento sob alta concorrência.

### 2.2. Cenários de carga

Foram avaliados três cenários, cada um com perfil de rampa (subida → sustentação → descida):

| Cenário | VUs sustentados | Perfil | SLO de latência (p95) |
|---|---|---|---|
| Normal | 30 | 30s ↑ · 2min sustenta · 30s ↓ | < 800 ms |
| Dia Corrido | 100 | 30s ↑ · 2min sustenta · 30s ↓ | < 1200 ms |
| Emergência | 250 | 45s ↑ · 1min30 sustenta · 45s ↓ | < 3000 ms |

### 2.3. Controle de variáveis

Cada execução parte de um **estado de banco idêntico**, recriado e semeado deterministicamente antes da carga (volumes zerados via `docker compose down -v`; pool fixo de 8 médicos e 40 pacientes criado em `setup()`). Dessa forma, a **única variável manipulada entre execuções é o nível de concorrência (VUs)** — o volume de dados pré-existente não interfere na latência das leituras, o que invalidaria a comparação.

---

## 3. Resultados Experimentais

A tabela a seguir consolida a latência **p95** (ms) por operação e o percentual de requisições dentro do SLO de latência, para cada nível de concorrência.

| Operação | 30 VUs | 100 VUs | 250 VUs |
|---|---:|---:|---:|
| Join 1 — `POST /atendimentos` (dual-write) | 21,0 | 535,4 | **3.035,9** |
| Join 2 — `GET /atendimentos/:id` | 5,1 | 225,1 | 2.672,6 |
| Join 3 — `GET …/historico-completo` | 6,4 | 231,3 | 2.581,3 |
| Join 4 — `POST /consultas-laudos` | 15,3 | 237,1 | 940,2 |
| Join 5 — `GET /medicos/:id/laudos` | 19,6 | 522,3 | **5.146,0** |
| **Geral (p95)** | **17,7** | **370,2** | **3.214,2** |
| Throughput (req/s) | 25,5 | 78,1 | 96,3 |
| % dentro do SLO (geral) | 100 % | 99,9 % | 74,4 % |
| Erros HTTP | 0 % | 0 % | 0 % |

### Fase A — Operação Estável (30 VUs)

Sob carga controlada, o sistema operou com folga: latência geral p95 de **17,7 ms**, com todas as operações na faixa de poucos milissegundos a ~21 ms (pico no Join 1), 0 % de erros e 100 % das requisições dentro do SLO. O monolito demonstra desempenho excelente em baixa demanda, sem qualquer sinal do overhead poliglota se manifestar de forma sensível.

### Fase B — Saturação Logística (100 VUs)

Ao escalar para 100 VUs, a latência sobe para a casa das centenas de milissegundos (p95 geral de **370,2 ms**), mas o sistema permanece **funcional e estável**: 0 % de erros e ~99,9 % das requisições dentro do SLO. O throughput salta de 25,6 para 78,1 req/s — um crescimento ainda proporcional ao aumento de carga. É o regime de "dia corrido": o monolito absorve picos moderados sem comprometer o serviço.

### Fase C — Degradação Estrutural (250 VUs)

Com 250 VUs, o comportamento muda qualitativamente. A latência geral p95 **explode para 3.214 ms** — um aumento de aproximadamente **8,7×** em relação a 100 VUs. As operações individuais sobem na mesma ordem: o Join 1 (dual-write) atinge 3.036 ms e o Join 5 chega a **5.146 ms** de p95. O percentual de requisições dentro do SLO despenca para **74 % no geral e 30–41 % nas leituras poliglotas**.

Dois fatos são decisivos para a análise:

1. **Throughput em platô.** Entre 100 e 250 VUs o número de usuários cresceu 150 %, mas o throughput subiu apenas ~23 % (78,1 → 96,3 req/s). O sistema atingiu seu teto de vazão útil: usuários adicionais não geram mais trabalho concluído, apenas engrossam a fila de I/O.
2. **Degradação por lentidão, não por falha.** A taxa de erros HTTP permaneceu em **0 %** em todos os cenários. O monolito não "cai" nem rejeita requisições neste intervalo — ele se torna inutilizável pela latência (respostas de 3 a 5 segundos), com as conexões do pool integralmente retidas pelo encadeamento síncrono do Join 1.

---

## 4. Análise: o Acoplamento de Recursos e o Raio de Explosão

O dado mais revelador não é a lentidão do endpoint pesado, e sim **quem mais sofre com ela**. A 250 VUs, o **Join 5 — uma leitura** (`GET /medicos/:id/laudos`) — torna-se a operação **mais lenta de todo o sistema (5.146 ms de p95)**, superando inclusive o dual-write que deveria ser o gargalo natural.

Isso evidencia empiricamente o **acoplamento nocivo de recursos** da arquitetura monolítica: como todos os fluxos — escritas pesadas e leituras leves — compartilham o mesmo pool de conexões, o mesmo event loop single-thread e o mesmo hardware, o Join 1 sequestra a infraestrutura e **derruba por arrasto** operações que, isoladas, teriam recursos de sobra. Uma leitura barata é punida pela vizinhança de uma escrita cara.

O **joelho da curva** situa-se claramente **entre 100 e 250 VUs**: é nessa faixa que o sistema transita de "estável sob pressão" para "degradado".

---

## 5. Justificativa de Trade-off para a Migração Arquitetural

Os resultados legitimam a investigação da arquitetura de microsserviços sobre dois pilares:

1. **Ineficiência da escalabilidade vertical.** Resolver o gargalo expandindo o hardware do container monolítico (ex.: 8 vCPUs / 16 GB) obrigaria a custear recursos para todo o ecossistema — inclusive componentes ociosos — apenas para salvar o módulo de Atendimentos. Os microsserviços permitem **isolar e escalar somente o componente saturado**, com eficiência de custo.

2. **Minimização do raio de explosão (*blast radius*).** Os dados comprovam que, no monolito, a saturação de um fluxo contamina os demais (Join 1 derrubando o Join 5). A separação de domínios em serviços com **pools de dados independentes** garante que a sobrecarga de um fluxo complexo não comprometa operações vitais e independentes do PEP.

---

## 6. Ameaças à Validade e Limitações

Em nome do rigor, registram-se as seguintes limitações, que **não invalidam a comparação relativa**, mas qualificam os números absolutos:

- **Baseline de dados enxuto.** Cada execução parte de um banco recém-semeado (pool reduzido). Os números absolutos representam, portanto, um **limite inferior** (condição otimista); um PEP de produção, com volumes elevados, apresentaria latências ainda maiores. O gargalo medido (exaustão de pool, dual-write sequencial, saturação do event loop) **independe do volume das tabelas**, de modo que a tendência observada se mantém.
- **Ambiente local de máquina única.** Aplicação, bancos e gerador de carga compartilham o mesmo hospedeiro físico, o que pode introduzir contenção de CPU/IO adicional.
- **Comparação pendente.** Esta seção caracteriza **apenas a arquitetura monolítica**. A conclusão da hipótese central — de que os microsserviços superam o monolito sob alta carga — depende da execução da mesma bateria (mesmos cenários, mesmos limites de hardware, operações funcionalmente equivalentes) contra o backend de microsserviços, com posterior consolidação comparativa dos resultados.

---

*Dados-fonte: `k6-scripts/results/` (CSV por execução) e `k6-scripts/consolidado-monolito.csv`. Métricas exportadas automaticamente pelo k6 ao fim de cada teste (`handleSummary`).*
