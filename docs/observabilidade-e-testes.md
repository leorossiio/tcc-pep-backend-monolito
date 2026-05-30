# Observabilidade e Testes de Carga — TCC PEP Backend Monolito

Documentação consolidada da stack de observabilidade e testes de performance: **k6** (geração de carga), **Prometheus** (coleta de métricas) e **Grafana** (visualização). Este documento serve como referência para todos os trabalhos futuros envolvendo testes de carga e observabilidade.

---

## 1. Visão Geral da Stack

### Arquitetura de Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  k6 (container: k6_pep)                                    │
│  └─ HTTP requests → app-monolito:3000                      │
│  └─ remote-write → prometheus_pep:9090/api/v1/write        │
│                                                             │
│  NestJS Application (container: app_nestjs_monolito)       │
│  └─ HTTP handlers e LoggingInterceptor                     │
│  └─ Expõe GET /metrics com:                                │
│      - http_request_duration_seconds{method,path,status}   │
│      - http_requests_total{method,path,status}             │
│      - Métricas default Node.js                            │
│                                                             │
│  Prometheus (container: prometheus_pep)                    │
│  └─ Scrape a cada 5s ← app-monolito:3000/metrics          │
│  └─ Recebe remote-write do k6                              │
│  └─ Retenção: 7 dias                                       │
│  └─ Porta: 9090                                            │
│                                                             │
│  Grafana (container: grafana_pep)                          │
│  └─ Lê Prometheus via proxy ← prometheus_pep:9090          │
│  └─ Dashboards provisionados de ./grafana/provisioning/    │
│  └─ Acesso: http://localhost:3005 (admin/admin)           │
│  └─ Porta host: 3005 → container: 3000                     │
│                                                             │
│  Network: pep_network (bridge)                             │
└─────────────────────────────────────────────────────────────┘
```

### Duas Fontes de Métricas Distintas

1. **Métricas NestJS (via scrape HTTP):**
   - Histogramas de latência por endpoint (buckets em segundos)
   - Contadores de requisições HTTP
   - Métricas default de runtime Node.js (heap, event loop, GC)
   - Colhidas pelo Prometheus a cada 5 segundos
   - **Usado para:** Análise de comportamento do servidor real (joins poliglotas, latência de endpoints)

2. **Métricas k6 (via remote-write):**
   - Métricas pré-calculadas: p95, p99, avg, min, max
   - VUs ativos em tempo real
   - Taxa de erros e checks (validações de teste)
   - **Requer flag `--out experimental-prometheus-rw` ao executar o k6** (não é automático)
   - Configuradas via variáveis de ambiente no `docker-compose.yml`: `K6_PROMETHEUS_RW_SERVER_URL` e `K6_PROMETHEUS_RW_TREND_STATS`
   - **Usado para:** Perspectiva da carga (quantos usuários, qual taxa de erro, percentis de latência do cliente)

> **Distinção importante:** As métricas NestJS mostram como o *servidor experimenta* cada requisição (latência interna). As métricas k6 mostram como o *cliente/carga experimenta* o servidor (VUs, erros HTTP, SLOs). Para benchmarking, os dois dados juntos permitem correlacionar: "a 250 VUs simultâneos, o p95 do servidor foi Xms e a taxa de erro do cliente foi Y%". Sem o remote-write do k6, apenas a perspectiva do servidor fica visível.

---

## 2. Prometheus — Configuração e Comportamento

### Arquivo de Configuração

**Arquivo:** `prometheus.yml` (raiz do projeto)

```yaml
global:
  scrape_interval: 5s

scrape_configs:
  - job_name: 'nestjs-monolito'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['app-monolito:3000']
```

**Parâmetros:**
- `global.scrape_interval: 5s` — Prometheus scrapa o endpoint `/metrics` a cada 5 segundos
- `job_name: 'nestjs-monolito'` — Nome do job (aparece em dashboards e logs)
- `targets: ['app-monolito:3000']` — Target deve ser o nome do container (docker-compose resolve nomes internamente)
- `metrics_path: '/metrics'` — Endpoint padrão exposto pelo `@willsoto/nestjs-prometheus`

### Flags de Execução (docker-compose.yml)

```yaml
prometheus:
  image: prom/prometheus:latest
  command:
    - '--config.file=/etc/prometheus/prometheus.yml'
    - '--web.enable-remote-write-receiver'
    - '--storage.tsdb.retention.time=7d'
```

**Flags importantes:**
- `--web.enable-remote-write-receiver` — Habilita o Prometheus a receber métricas via HTTP remote-write (usado pelo k6)
- `--storage.tsdb.retention.time=7d` — Mantém dados por 7 dias (suficiente para análise pós-teste)

### Porta e Acesso

- **Porta interna (container):** 9090
- **Porta host:** 9090
- **URL interna (docker-compose):** `http://prometheus_pep:9090`
- **URL local:** `http://localhost:9090`
- **Acesso sem autenticação**

---

## 3. Métricas NestJS — LoggingInterceptor

### Configuração do Módulo Prometheus

**Arquivo:** `src/app.module.ts`

```typescript
PrometheusModule.register({
  path: '/metrics',
  defaultMetrics: { enabled: true },
})
```

**Configurações:**
- `path: '/metrics'` — Endpoint de scrape (HTTP GET)
- `defaultMetrics.enabled: true` — Habilita coleta automática de métricas Node.js
- Sem `prefix` customizado (métricas default não recebem prefixo)
- Usa `prom-client` versão `^15.1.3`
- NestJS Prometheus provider: `@willsoto/nestjs-prometheus` versão `^6.1.0`

### Métricas Customizadas Definidas

**Arquivo:** `src/common/interceptors/LoggingInterceptor.ts`

| Nome da Métrica | Tipo | Labels | Buckets/Opções | Help Text |
|---|---|---|---|---|
| `http_request_duration_seconds` | Histogram | `method`, `path`, `status` | `[0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5]` | "Duração das requisições HTTP em segundos" |
| `http_requests_total` | Counter | `method`, `path`, `status` | — | "Total de requisições HTTP" |

**Explicação dos labels:**

- **`method`:** Verbo HTTP (GET, POST, PATCH, DELETE, PUT)
- **`path`:** Template de rota normalizado (ex: `/atendimentos/:id`, `/pacientes/:pacienteId`, não o valor real da variável)
  - Extraído via `req.route?.path` com fallback para `req.url`
  - Essencial para agregar métricas de múltiplas requisições para o mesmo endpoint
- **`status`:** Código HTTP de resposta (200, 201, 400, 500, etc.) como string

### Comportamento do Interceptor

**Arquivo:** `src/main.ts`

```typescript
app.useGlobalInterceptors(new LoggingInterceptor());
```

**Aplicação:**
- Instanciado globalmente (aplica a **todas as rotas**)
- Não é gerenciado pelo DI container (instância manual)
- Executa **antes** e **depois** de cada requisição

**Ações executadas:**

1. **Ao iniciar resposta:**
   - Registra timestamp de início
   
2. **Ao terminar resposta:**
   - Calcula duração em segundos: `(Date.now() - inicio) / 1000`
   - Incrementa `http_request_duration_seconds{method, path, status}` com a duração (histogram)
   - Incrementa `http_requests_total{method, path, status}` em 1 (counter)
   - Log estruturado: `METHOD PATH STATUS — Xms` (via `Logger` do NestJS com contexto `'HTTP'`)

**Exemplo de output esperado:**
```
[LOG] HTTP GET /pacientes 200 — 45ms
[LOG] HTTP POST /atendimentos 201 — 320ms
```

### Métricas Default Node.js

Habilitadas via `defaultMetrics: { enabled: true }`. Incluem:

- `process_*` — CPU, memória, file descriptors do processo
- `nodejs_*` — Heap size (used/total), external memory, array buffer memory
- `nodejs_eventloop_*` — Event loop lag, delays
- `nodejs_gc_*` — Garbage collection events e duração
- Outras métricas de runtime

**Exemplo de query em Grafana:**
```promql
nodejs_heap_size_used_bytes / 1024 / 1024   # Heap usado em MB
```

---

## 4. k6 — Scripts de Teste de Carga

### k6 no docker-compose.yml

```yaml
k6:
  image: grafana/k6:latest
  container_name: k6_pep
  volumes:
    - ./k6-scripts:/scripts
  networks:
    - pep_network
```

**Comportamento:**
- Container permanece ativo (nenhum comando padrão)
- Scripts devem ser executados manualmente via `docker exec`
- Volume monta `./k6-scripts/` → `/scripts` (scripts acessíveis em `/scripts/` dentro do container)

### Acesso ao Container k6

```bash
# Entrar no shell do container k6
docker exec -it k6_pep sh

# Dentro do container, listar scripts disponíveis
ls /scripts

# Sair
exit
```

---

## 4.1 cenario-emergencia.js — Benchmark Principal do Monolito

**Arquivo:** `k6-scripts/cenario-emergencia.js`

### Perfis de Carga (Seleção via ENV)

Três perfis podem ser selecionados via `__ENV.SCENARIO` (padrão: `'1'`):

#### Cenário 1: Normal

| Parâmetro | Valor |
|---|---|
| Label | Normal |
| Ramp-up | 30s para atingir 50 VUs |
| Sustain | 2 min a 50 VUs |
| Ramp-down | 30s descendo para 0 VUs |
| **Duração total** | ~3 min |
| **SLO latência** | p95 < 800ms |
| **SLO erros** | taxa de falha < 1% |

#### Cenário 2: Dia Corrido

| Parâmetro | Valor |
|---|---|
| Label | Dia Corrido |
| Ramp-up | 30s para atingir 100 VUs |
| Sustain | 2 min a 100 VUs |
| Ramp-down | 30s descendo para 0 VUs |
| **Duração total** | ~3 min |
| **SLO latência** | p95 < 1200ms |
| **SLO erros** | taxa de falha < 5% |

#### Cenário 3: Emergência

| Parâmetro | Valor |
|---|---|
| Label | Emergência |
| Ramp-up | 45s para atingir 250 VUs |
| Sustain | 1 min 30s a 250 VUs |
| Ramp-down | 45s descendo para 0 VUs |
| **Duração total** | ~4 min 30s |
| **SLO latência** | p95 < 3000ms |
| **SLO erros** | taxa de falha < 15% |

### Fase setup() — Executada Uma Única Vez Antes do Teste

A função `setup()` cria dados de teste pré-requisitos que serão usados por todas as iterações. Retorna IDs que são passados para `default()`.

**Requisições na ordem:**

1. **POST /medicos — Criar Médico**
   - Body: `{ nomeCompleto, crm, especialidade, ativo: true }`
   - CRM gerado: `K6{Date.now()}/SP` (ex: `K6169203456789/SP`) — único por execução
   - Especialidade: valor fixo (ex: `"Cardiologia"`)
   - Response: `{ id, ... }` (captura `medicoId`)

2. **POST /pacientes — Criar Paciente**
   - Body: `{ nomeCompleto, sexo, cpf, dataNascimento, consentimentoLgpd: true }`
   - CPF: derivado de `Date.now()` (11 dígitos) — única por execução
   - Sexo: `"M"` ou `"F"` (alternado para variação)
   - Response: `{ id, ... }` (captura `pacienteId`)

3. **POST /atendimentos — Criar Atendimento de Referência**
   - Body: `{ pacienteId, medicoTriagemId, dataHoraEntrada, queixaPrincipal, pressaoArterial, frequenciaCardiaca, saturacaoOxigenio, temperaturaCorporal, frequenciaRespiratoria, classificacaoRisco }`
   - `classificacaoRisco`: `'VERMELHO'` (constante)
   - Vitais: valores hardcoded realistas
   - Response: `{ id, ... }` (captura `atendimentoId`)

4. **GET /historico-clinicos/paciente/:pacienteId — Obter ou Criar Histórico Clínico**
   - URL: `GET /historico-clinicos/paciente/{pacienteId}`
   - Response: `{ _id, pacienteId, ... }` (captura `historicoId` do MongoDB)

5. **POST /consultas-laudos — Criar Laudo Inicial (TRIAGEM)**
   - Body: `{ atendimentoId, historicoId, pacienteId, medicoId, dataRegistro, tipoRegistro: 'TRIAGEM', descricaoClinica }`
   - Tipo: `'TRIAGEM'` (fixo, identifica a triagem)
   - Response: `{ _id, ... }`

**Dados retornados para `default()`:**
```javascript
return {
  medicoId,
  pacienteId,
  atendimentoId,
  historicoId
}
```

### Fase default() — Executada por VU e Iteração

Cada virtual user executa `default()` repetidamente até o final do teste. Uma iteração consiste em 5 requisições + 4 segundos de espera (1s entre cada requisição).

#### Step 1: GET /atendimentos/:id — Join Poliglota 2 (Leitura PG→Mongo)

```javascript
http.get(`http://app-monolito:3000/atendimentos/${__VU}-${__ITER}`, {
  tags: { name: 'Join 2' }
})
```

**O que acontece no backend:**
- Busca `Atendimento` em PostgreSQL
- Busca `ConsultasLaudos` correspondentes em MongoDB
- Retorna join: `{ ...atendimento, consultasLaudos: [...] }`

**Checks (validações):**
- `status == 200`
- Latência < 500ms
- Labels no Grafana: `[Join 2] prontuario 200`, `[Join 2] latencia < 500ms`

**Sleep:** 1 segundo

#### Step 2: GET /pacientes/:pacienteId/historico-completo — Join Poliglota 3 (Visão 360°)

```javascript
http.get(`http://app-monolito:3000/pacientes/${pacienteId}/historico-completo`, {
  tags: { name: 'Join 3' }
})
```

**O que acontece:**
- Busca `Paciente` em PostgreSQL (dados estruturados)
- Busca `HistoricoClinico` em MongoDB (dados clínicos)
- Busca `Atendimentos` históricos em PostgreSQL
- Busca `ConsultasLaudos` em MongoDB
- Retorna visão consolidada do paciente

**Checks:**
- `status == 200`
- Latência < 600ms
- Labels: `[Join 3] historico-completo 200`, `[Join 3] latencia < 600ms`

**Sleep:** 1 segundo

#### Step 3: POST /atendimentos — Join Poliglota 1 (Dual-Write PG+Mongo)

```javascript
http.post(`http://app-monolito:3000/atendimentos`, JSON.stringify({
  pacienteId,
  medicoTriagemId: medicoId,
  dataHoraEntrada: new Date().toISOString(),
  queixaPrincipal: `VU ${__VU} iter ${__ITER} — dor toracica intensa`,
  pressaoArterial: '120/80',
  frequenciaCardiaca: 72,
  saturacaoOxigenio: 98,
  temperaturaCorporal: 36.5,
  frequenciaRespiratoria: 16,
  classificacaoRisco: 'VERMELHO'
}), {
  headers: { 'Content-Type': 'application/json' },
  tags: { name: 'Join 1' }
})
```

**O que acontece:**
1. Cria `Atendimento` em PostgreSQL
2. Cria/obtém `HistoricoClinico` em MongoDB (idempotent)
3. Cria `ConsultaLaudo` de tipo TRIAGEM em MongoDB
4. Cria `LogAuditoria` em PostgreSQL
5. Retorna `{ id, ...atendimento }`

**Checks:**
- `status == 201` (Created)
- Latência < 800ms
- Labels: `[Join 1] dual-write 201`, `[Join 1] latencia < 800ms`

**Importante:** A queixa principal inclui `VU ${__VU}` e `iter ${__ITER}` para tornar cada requisição única no banco de dados, evitando duplicatas exatas.

**Sleep:** 1 segundo

#### Step 4: POST /consultas-laudos — Join Poliglota 4 (Laudo com Prescrições)

```javascript
http.post(`http://app-monolito:3000/consultas-laudos`, JSON.stringify({
  atendimentoId: novoAtendimentoId,  // do Step 3
  historicoId,                       // do setup()
  pacienteId,
  medicoId,
  dataRegistro: new Date().toISOString(),
  tipoRegistro: 'CONSULTA',
  descricaoClinica: `Laudo da iteração ${__ITER}: paciente estável`,
  prescricoes: [
    { medicamento: 'AAS', dose: '300mg', frequencia: 'UVA', duracao: '7 dias' },
    { medicamento: 'Morfina', dose: '2mg', frequencia: 'IV', duracao: '2 horas' }
  ]
}), {
  headers: { 'Content-Type': 'application/json' },
  tags: { name: 'Join 4' }
})
```

**O que acontece:**
- Cria `ConsultaLaudo` em MongoDB com tipo `'CONSULTA'`
- Propaga novas alergias (se houver) para `HistoricoClinico`
- Cria audit log em PostgreSQL
- Retorna `{ _id, ... }`

**Checks:**
- `status == 201`
- Latência < 800ms
- Labels: `[Join 4] laudo 201`, `[Join 4] latencia < 800ms`

**Sleep:** 1 segundo

#### Step 5: GET /medicos/:medicoId/laudos — Join Poliglota 5 (Laudos por Médico)

```javascript
http.get(`http://app-monolito:3000/medicos/${medicoId}/laudos`, {
  tags: { name: 'Join 5' }
})
```

**O que acontece:**
- Busca `Medico` em PostgreSQL
- Busca `Atendimentos` do médico em PostgreSQL
- Busca `ConsultasLaudos` do médico em MongoDB
- Retorna lista de laudos

**Checks:**
- `status == 200`
- Latência < 700ms
- Labels: `[Join 5] laudos-medico 200`, `[Join 5] latencia < 700ms`

**Sleep:** 1 segundo (última iteração)

### Tag Global

Todas as requisições no `default()` são tagueadas com:
```javascript
tags: { test_scenario: 'normal' | 'dia-corrido' | 'emergencia' }
```

Isso permite filtrar por cenário nos dashboards Grafana: `test_scenario="normal"`

### Como Executar cenario-emergencia.js

> **Obrigatório:** usar a flag `--out experimental-prometheus-rw` para que as métricas k6 cheguem ao Prometheus e apareçam nos dashboards Grafana. Sem essa flag, apenas os histogramas NestJS terão dados — VUs, throughput, taxa de erros e checks ficarão vazios.

```bash
# 1. Subir containers (já inclui K6_PROMETHEUS_RW_SERVER_URL nas env vars do k6)
docker compose up -d

# 2. Entrar no container k6
docker exec -it k6_pep sh

# 3. Executar cenários COM remote-write habilitado

# Cenário 1 (Normal) — padrão
k6 run --out experimental-prometheus-rw /scripts/cenario-emergencia.js

# Cenário 2 (Dia Corrido)
k6 run --out experimental-prometheus-rw -e SCENARIO=2 /scripts/cenario-emergencia.js

# Cenário 3 (Emergência)
k6 run --out experimental-prometheus-rw -e SCENARIO=3 /scripts/cenario-emergencia.js
```

**O que acontece após executar:**
- k6 gera carga nos endpoints configurados
- Métricas NestJS (histogramas) são coletadas pelo Prometheus a cada 5s
- Métricas k6 (VUs, throughput, checks) são enviadas via remote-write para `prometheus_pep:9090/api/v1/write`
- Dashboards Grafana atualizam automaticamente (refresh 5s)
- Ao final, k6 imprime summary no stdout com pass/fail de cada threshold SLO

---

## 4.2 cenario-mono-ms.js — Benchmark Comparativo: Monolito vs Microsserviços

**Arquivo:** `k6-scripts/cenario-mono-ms.js`

### Propósito

Compara performance e comportamento entre arquitetura **monolítica** (uma app NestJS) e **microsserviços** (múltiplas apps, cada uma responsável por domínio). Cada iteração executa a mesma operação em ambas arquiteturas e registra as diferenças de latência, throughput e taxa de erro.

### Diferenças do cenario-emergencia.js

| Aspecto | cenario-emergencia.js | cenario-mono-ms.js |
|---|---|---|
| **Presença de setup()** | Sim (cria médico, paciente, atendimento) | Não — assume IDs pré-existentes |
| **Target** | `app-monolito:3000` (único) | Dois targets: monolito + microsserviços |
| **Tagging** | `test_scenario` (normal/dia-corrido/emergencia) | `test_scenario`, `arquitetura`, `name` |
| **Métricas** | Histogramas NestJS + k6 percentis | k6 percentis (`_p95`, `_p99`, `_avg`) |
| **Max VUs** | 250 | 450 |
| **SLO p95** | Diferente por cenário (800/1200/3000ms) | 2000ms flat |
| **SLO erros** | Diferente por cenário (1/5/15%) | 5% flat |

### Variáveis de Ambiente

| Variável | Padrão | Propósito |
|---|---|---|
| `__ENV.SCENARIO` | `'1'` | Perfil de carga (1, 2 ou 3) |
| `__ENV.MONO_URL` | `http://app_nestjs_monolito:3000` | URL base do monolito |
| `__ENV.MEDICO_ID` | `'1'` | ID de médico pré-existente |
| `__ENV.PACIENTE_ID` | `'1'` | ID de paciente pré-existente |

**Como passar ao executar:**
```bash
k6 run -e MONO_URL=http://app-monolito:3000 \
       -e MEDICO_ID=abc-123 \
       -e PACIENTE_ID=def-456 \
       /scripts/cenario-mono-ms.js
```

### Perfis de Carga

#### Cenário 1

| Parâmetro | Valor |
|---|---|
| Ramp-up | 30s → 20 VUs, depois jump para 50 VUs |
| Sustain | 2 min a 50 VUs |
| Ramp-down | 30s → 0 |

#### Cenário 2

| Parâmetro | Valor |
|---|---|
| Ramp-up | 30s → 50 VUs → jump para 200 VUs |
| Sustain | 3 min a 200 VUs |
| Ramp-down | 1 min → 0 |

#### Cenário 3

| Parâmetro | Valor |
|---|---|
| Ramp-up | 30s → 100 VUs → jump para 450 VUs |
| Sustain | 4 min a 450 VUs |
| Ramp-down | 1 min → 0 |

### Thresholds (SLOs)

Definidos com tags `arquitetura` para discriminação:

```javascript
thresholds: {
  'http_req_duration{arquitetura:monolito}': [ 'p(95) < 2000ms', 'p(99) < 3000ms' ],
  'http_req_duration{arquitetura:ms}':        [ 'p(95) < 2000ms', 'p(99) < 3000ms' ],
  'http_req_failed{arquitetura:monolito}':    [ 'rate < 5%' ],
  'http_req_failed{arquitetura:ms}':          [ 'rate < 5%' ]
}
```

**Resultado:** k6 reporta pass/fail **independente** para cada arquitetura, permitindo comparação fair.

### Fase default() — 5 Operações Lado a Lado

Cada VU executa 5 pares de requisições (monolito + microsserviço correspondente), intercaladas com sleeps curtos.

#### Operação 1: GET /medicos/:id

**Monolito:**
```javascript
http.get(`${__ENV.MONO_URL}/medicos/${__ENV.MEDICO_ID}`, monoTag('GET /medicos'))
```

**Microsserviço (ms_medicos):**
```javascript
http.get(`http://ms_medicos:3001/medicos/${__ENV.MEDICO_ID}`, msTag('GET /medicos'))
```

**Sleep:** 0.2s

#### Operação 2: POST /pacientes

**Monolito:**
```javascript
http.post(`${__ENV.MONO_URL}/pacientes`, JSON.stringify({
  nomeCompleto: `Paciente K6 ${Date.now()}`,
  sexo: 'M',
  cpf: `${Math.floor(Math.random() * 90000000000) + 10000000000}`,
  dataNascimento: '1990-01-01',
  consentimentoLgpd: true
}), monoTag('POST /pacientes'))
```

**Microsserviço (ms_pacientes):**
```javascript
http.post(`http://ms_pacientes:3002/pacientes`, /* mesmo body */, msTag('POST /pacientes'))
```

**Sleep:** 0.2s

#### Operação 3: POST /atendimentos

**Monolito:**
```javascript
http.post(`${__ENV.MONO_URL}/atendimentos`, JSON.stringify({
  pacienteId: __ENV.PACIENTE_ID,
  medicoId: __ENV.MEDICO_ID,
  dataHoraEntrada: new Date().toISOString(),
  descricao: 'Teste de atendimento',
  prioridade: 'ALTA'
}), monoTag('POST /atendimentos'))
```

**Microsserviço (ms_atendimentos):**
```javascript
http.post(`http://ms_atendimentos:3003/atendimentos`, /* mesmo body */, msTag('POST /atendimentos'))
```

**Sleep:** 0.2s

#### Operação 4: GET /atendimentos (listagem)

**Monolito:**
```javascript
http.get(`${__ENV.MONO_URL}/atendimentos`, monoTag('GET /atendimentos'))
```

**Microsserviço:**
```javascript
http.get(`http://ms_atendimentos:3003/atendimentos`, msTag('GET /atendimentos'))
```

**Sleep:** 0.2s

#### Operação 5: GET /logs-auditoria

**Monolito:**
```javascript
http.get(`${__ENV.MONO_URL}/logs-auditoria`, monoTag('GET /logs-auditoria'))
```

**Microsserviço (ms_auditoria):**
```javascript
http.get(`http://ms_auditoria:3004/auditoria`, msTag('GET /logs-auditoria'))
```

**Sleep:** 0.3s

### Funções Helper: monoTag() e msTag()

```javascript
function monoTag(name) {
  return {
    tags: {
      arquitetura: 'monolito',
      name: name,
      test_scenario: 'mono-ms'
    }
  }
}

function msTag(name) {
  return {
    tags: {
      arquitetura: 'ms',
      name: name,
      test_scenario: 'mono-ms'
    }
  }
}
```

**Efeito:** Todas as requisições são tagueadas para que Prometheus e Grafana possam distinguir quais pertencem ao monolito e quais aos microsserviços.

### Como Executar cenario-mono-ms.js

**Pré-requisitos:**
- Monolito rodando em `app-monolito:3000`
- Microsserviços rodando em `ms_medicos:3001`, `ms_pacientes:3002`, `ms_atendimentos:3003`, `ms_auditoria:3004`
- IDs de médico e paciente já existentes no banco de dados

```bash
# 1. Entrar no container k6
docker exec -it k6_pep sh

# 2. Executar com env vars e remote-write habilitado
k6 run --out experimental-prometheus-rw \
       -e MONO_URL=http://app-monolito:3000 \
       -e MEDICO_ID=<uuid-do-medico> \
       -e PACIENTE_ID=<uuid-do-paciente> \
       -e SCENARIO=1 \
       /scripts/cenario-mono-ms.js
```

---

## 4.3 Integração de Métricas k6 com Prometheus

### Remote-Write Automático

**Comportamento automático (sem configuração extra):**

Quando k6 executa dentro de um container na network `pep_network`, ele detecta automaticamente o Prometheus e envia métricas via HTTP remote-write para `prometheus_pep:9090/api/v1/write`.

**Como funciona internamente:**
1. k6 coleta métricas localmente durante a execução
2. A cada N segundos, k6 serializa e envia um protobuf com as métricas acumuladas
3. Prometheus recebe e armazena (flag `--web.enable-remote-write-receiver` habilita isso)

**Não requer:**
- Flag `--out` no k6
- Configuração adicional em `prometheus.yml`
- Credenciais

### Métricas Disponíveis no Prometheus (post-teste)

Após o teste terminar, o Prometheus contém:

| Métrica k6 | Tipo | Labels | Exemplo PromQL |
|---|---|---|---|
| `k6_vus` | Gauge | `test_scenario` | `k6_vus{test_scenario="normal"}` |
| `k6_vus_max` | Gauge | `test_scenario` | `k6_vus_max{test_scenario="normal"}` |
| `k6_iterations` | Counter | `test_scenario` | `rate(k6_iterations[1m])` |
| `k6_iteration_duration_seconds` | Histogram | `test_scenario` | `histogram_quantile(0.95, ...)` |
| `k6_http_reqs_total` | Counter | `test_scenario`, (e mais labels) | `rate(k6_http_reqs_total{test_scenario="normal"}[30s])` |
| `k6_http_req_duration_p95` | Gauge | `test_scenario`, `name`, etc. | `k6_http_req_duration_p95{test_scenario="normal"}` |
| `k6_http_req_duration_p99` | Gauge | idem | `k6_http_req_duration_p99{...}` |
| `k6_http_req_failed_rate` | Gauge | idem | `k6_http_req_failed_rate{...}` |
| `k6_checks_rate` | Gauge | `test_scenario` | `k6_checks_rate{test_scenario="normal"}` |

---

## 5. Grafana — Dashboards de Monitoramento

### Acesso

**URL:** `http://localhost:3005`  
**Credenciais padrão:** `admin` / `admin`  
**Datasource pré-configurado:** Prometheus em `http://prometheus_pep:9090`

### Estrutura de Provisionamento

```
grafana/provisioning/
├── datasources/
│   └── prometheus.yml          # Datasource (readonly)
└── dashboards/
    ├── dashboards.yml          # Configuração de auto-load
    ├── tcc-pep-normal.json
    ├── tcc-pep-dia-corrido.json
    ├── tcc-pep-emergencia.json
    ├── tcc-pep-mono-ms-compara.json
    └── tcc-pep-esp-ms.json     # (vazio/placeholder)
```

**Comportamento:**
- Grafana carrega os JSONs automaticamente no startup
- Pasta no UI: "TCC"
- Refresh: a cada 30 segundos (verifica mudanças)
- Dashboards são read-only (não editáveis pelo UI para evitar perda)

### Dashboard 1: Cenário 1 — Normal

**UID:** `tcc-pep-normal`

**Filtro global:** `test_scenario="normal"` (nas queries PromQL)

**Painéis principais (seções):**

#### Seção: k6 — Visão Geral da Carga (Cenário Normal)

| Painel | Tipo | Métrica PromQL | Threshold | O que mede |
|---|---|---|---|---|
| **VUs Ativos** | Stat | `k6_vus{test_scenario="normal"}` | Yellow ≥ 25, Red ≥ 45 | Quantos usuários virtuais estão ativos **agora** |
| **Throughput (req/s)** | Stat | `sum(rate(k6_http_reqs_total{test_scenario="normal"}[30s]))` | Yellow ≥ 20 | Requisições por segundo |
| **Taxa de Erros (%)** | Stat | `(avg(k6_http_req_failed_rate{test_scenario="normal"}) \|\| vector(0)) * 100` | Yellow ≥ 0.5%, Red ≥ 1% | Percentual de requisições falhadas |
| **p99 Latência Geral (k6)** | Stat | `avg(k6_http_req_duration_p99{test_scenario="normal"}) * 1000` | Yellow ≥ 400ms, Red ≥ 800ms | 99º percentil de latência em **milissegundos** |
| **Checks k6 — % Passando Agora** | Stat | `k6_checks_rate{test_scenario="normal"}` | — | Taxa de sucesso das validações (checks) de teste |

#### Seção: Timeseries (Séries Temporais)

| Painel | Métrica | O que mede |
|---|---|---|
| **VUs ao Longo do Tempo** | `k6_vus{test_scenario="normal"}` | Ramp-up (0→50), sustain (50 const), ramp-down (50→0) da carga |
| **Throughput ao Longo do Tempo (req/s)** | `sum(rate(k6_http_reqs_total{test_scenario="normal"}[30s]))` | Requisições/s variam conforme VUs |

#### Seção: Joins Poliglotas — Foco do TCC

Compara latência de dois endpoints chave que demonstram o design poliglota (PG + Mongo):

| Painel | Endpoint | PromQL | O que mede |
|---|---|---|---|
| **Join 1 — Dual-Write (POST /atendimentos)** | POST /atendimentos | `histogram_quantile(0.50/0.95/0.99, sum(rate(http_request_duration_seconds_bucket{method="POST",path="/atendimentos"}[30s])) by (le)) * 1000` | Latência p50/p95/p99 em MS do dual-write (PG + Mongo) |
| **Join 2 — Leitura (GET /atendimentos/:id)** | GET /atendimentos/:id | `histogram_quantile(0.50/0.95/0.99, sum(rate(http_request_duration_seconds_bucket{method="GET",path="/atendimentos/:id"}[30s])) by (le)) * 1000` | Latência p50/p95/p99 em MS da leitura poliglota |

**Observação importante:** Estas queries usam histogramas **NestJS** (não k6), capturando latência real do servidor em tempo de scrape (5s). Permitem análise detalhada por bucket de latência.

#### Seção: Node.js — Runtime sob Carga

| Painel | Métrica | O que mede |
|---|---|---|
| **Heap Node.js (MB)** | `nodejs_heap_size_used_bytes / 1024 / 1024` e `nodejs_heap_size_total_bytes / 1024 / 1024` | Memória heapusada vs total (em MB) |
| **Event Loop Lag (ms)** | `nodejs_eventloop_lag_seconds * 1000` | Delay do event loop (sinal de saturação) |

#### Seção: k6 — Latência por Fase e Checks Detalhados

| Painel | Métrica | O que mede |
|---|---|---|
| **Heatmap de Latência HTTP — k6** | `k6_http_req_duration_p99`, `k6_http_req_waiting_p99`, `k6_http_req_receiving_p99`, `k6_http_req_sending_p99`, `k6_http_req_connecting_p99` | Breakdown de latência em fases: connecting, sending, waiting (processamento), receiving |
| **Checks por Segundo — pass/fail por nome (k6)** | `k6_checks_rate{test_scenario="normal"}` (pass) e `1 - k6_checks_rate` (fail) | Taxa de sucesso das validações do teste |

### Dashboard 2: Cenário 2 — Dia Corrido

**UID:** `tcc-pep-dia-corrido`

**Estrutura:** Idêntica ao Cenário Normal (mesma quantidade de painéis, mesmos tipos de visualização)

**Diferenças:**
- Filtro: `test_scenario="dia-corrido"`
- Thresholds distintos:
  - VUs: Yellow ≥ 50, Red ≥ 90 (mais alta que Normal)
  - Erros: Yellow ≥ 1%, Red ≥ 5% (mais leniente)
  - p99: Yellow ≥ 600ms, Red ≥ 1200ms (mais tolerante)

**Queries de Joins Poliglotas:**
- Igual ao Cenário Normal (não filtram por `test_scenario`, pois medem a latência real do servidor independente do teste ativo)
- Mostram `http_request_duration_seconds_bucket` histórica (5 dias)

### Dashboard 3: Cenário 3 — Emergência

**UID:** `tcc-pep-emergencia`

**Estrutura:** Idêntica aos anteriores

**Diferenças:**
- Filtro: `test_scenario="emergencia"`
- Thresholds muito mais lenientes (contexto de emergência):
  - VUs: Yellow ≥ 100, Red ≥ 200 (muito mais VUs esperados)
  - Erros: Yellow ≥ 5%, Red ≥ 15% (até 15% de falha aceitável em emergência)
  - p99: Yellow ≥ 1000ms, Red ≥ 2500ms (latência alta tolerada)

### Dashboard 4: Monolito vs Microsserviços

**UID:** `tcc-pep-mono-ms`

**Filtro global:** `test_scenario="mono-ms"` + discriminação por `arquitetura`

**Propósito:** Comparação lado a lado de monolito vs. microsserviços

#### Seção: Visão Geral — Monolito vs MS

| Painel | Tipo | Métrica | O que mede |
|---|---|---|---|
| **VUs Ativos (total)** | Stat | `sum(k6_vus{test_scenario="mono-ms"})` | Total de VUs no teste comparativo |
| **Throughput — Monolito** | Stat | `sum(rate(k6_http_reqs_total{arquitetura="monolito",test_scenario="mono-ms"}[30s]))` | Req/s do monolito |
| **Throughput — MS** | Stat | `sum(rate(k6_http_reqs_total{arquitetura="ms",test_scenario="mono-ms"}[30s]))` | Req/s dos microsserviços |
| **P95 Latencia — Monolito** | Stat | `avg(k6_http_req_duration_p95{arquitetura="monolito",test_scenario="mono-ms"}) * 1000` | p95 em MS (monolito) |
| **P95 Latencia — MS** | Stat | `avg(k6_http_req_duration_p95{arquitetura="ms",test_scenario="mono-ms"}) * 1000` | p95 em MS (microsserviços) |
| **Taxa de Erros — Monolito (%)** | Stat | `(avg(k6_http_req_failed_rate{arquitetura="monolito",test_scenario="mono-ms"}) \|\| vector(0)) * 100` | % de falhas (monolito) |
| **Taxa de Erros — MS (%)** | Stat | `(avg(k6_http_req_failed_rate{arquitetura="ms",test_scenario="mono-ms"}) \|\| vector(0)) * 100` | % de falhas (microsserviços) |

#### Seção: Latencia Comparada (P95 e P99)

| Painel | Tipo | Métrica | O que mede |
|---|---|---|---|
| **Latencia P95 — Monolito vs MS** | Timeseries | `avg(k6_http_req_duration_p95{arquitetura="monolito",...}) * 1000` (linha azul) vs `{arquitetura="ms",...} * 1000` (linha vermelha) | Evolução temporal do p95 em cada arquitetura |
| **Latencia P99 — Monolito vs MS** | Timeseries | Idem com `_p99` | Evolução temporal do p99 |

#### Seção: Throughput e Taxa de Erros

| Painel | Tipo | O que mede |
|---|---|---|
| **Throughput (req/s) — Monolito vs MS** | Timeseries | Req/s ao longo do tempo para cada arquitetura |
| **Taxa de Erros (%) — Monolito vs MS** | Timeseries | % de erros ao longo do tempo |

#### Seção: POST /atendimentos — Ponto Crítico

| Painel | O que mede |
|---|---|
| **P95 — POST /atendimentos — Monolito vs MS** | p95 específico do endpoint POST /atendimentos (dual-write crítico) |
| **Media Latencia — POST /atendimentos** | Latência média (não p95) para comparação |

#### Seção: Latencia P95 por Operacao (Monolito vs MS)

| Painel | Operação | O que mede |
|---|---|---|
| **GET /medicos — P95** | GET /medicos | p95 desta operação por arquitetura |
| **GET /pacientes — P95** | POST /pacientes | p95 desta operação |
| **GET /atendimentos — P95** | GET /atendimentos | p95 desta operação |
| **GET /logs-auditoria — P95** | GET /logs-auditoria | p95 desta operação |

#### Seção: VUs e Checks por Arquitetura

| Painel | O que mede |
|---|---|
| **VUs ao Longo do Tempo** | Ramp-up/sustain/ramp-down do teste |
| **Checks — Monolito (% passando)** | Taxa de sucesso das validações no monolito |
| **Checks — MS (% passando)** | Taxa de sucesso das validações nos MS |

### Dashboard 5: tcc-pep-esp-ms.json

**Status:** Placeholder (arquivo vazio, 0 bytes)

**Propósito:** Reservado para dashboard especializado em análise de microsserviços. Não está implementado.

---

## 6. Fluxo Completo: Do k6 ao Grafana

### Passo a Passo de uma Execução

```
1. docker compose up -d
   └─ Inicia: app, postgres, mongo, prometheus, grafana, k6

2. docker exec -it k6_pep sh
   └─ Abre shell no container k6

3. k6 run -e SCENARIO=1 /scripts/cenario-emergencia.js
   └─ k6 inicia teste com 50 VUs (ramp-up 30s, sustain 2min, ramp-down 30s)
   └─ Cada VU executa 5 requisições HTTP
   └─ k6 agrega métricas localmente (vus, iterations, http_reqs, duration percentis)
   └─ A cada 5s, k6 envia remote-write para Prometheus (:9090/api/v1/write)

4. Enquanto k6 está executando (em paralelo):
   └─ NestJS LoggingInterceptor captura cada requisição
   └─ Incrementa `http_request_duration_seconds` histogram
   └─ Incrementa `http_requests_total` counter
   └─ A cada 5s, Prometheus scrapa GET /metrics
   └─ Armazena histogramas e counters no TSDB local

5. Durante execução, abrir Grafana (localhost:3005)
   └─ Dashboard tcc-pep-normal mostra:
      - VUs ativos (k6_vus do remote-write)
      - Throughput (rate de k6_http_reqs_total)
      - Taxa de erros (k6_http_req_failed_rate)
      - Latência p95/p99 (k6 percentis)
      - Latência dos joins poliglotas (histogramas NestJS)

6. k6 finaliza teste
   └─ Imprime summary no stdout (pass/fail dos thresholds)
   └─ Exemplo:
      ✓ http_req_duration p(95) < 800ms  [PASS]
      ✓ http_req_failed rate < 1%       [PASS]
      ✓ checks [Join 1] latencia < 800ms [PASS]

7. Dashboard Grafana permanece atualizado por 7 dias (retenção Prometheus)
   └─ Pode-se analisar histórico completo do teste
   └─ Comparar cenários (Normal vs Dia Corrido vs Emergência)
```

---

## 7. Troubleshooting e Observações Importantes

### k6 não consegue conectar ao Prometheus

**Problema:** k6 está fora da rede Docker ou Prometheus não está acessível.

**Solução:**
- Confirmar que k6 está no mesmo `docker-compose.yml` com network `pep_network`
- Confirmar que Prometheus está rodando: `docker compose ps` (deve listar `prometheus_pep`)
- Confirmar que Prometheus tem flag `--web.enable-remote-write-receiver`
- Verificar logs do Prometheus: `docker logs prometheus_pep | grep remote-write`

### Grafana não mostra métricas k6

**Problema:** Dashboards estão vazios ou mostram "No Data".

**Solução:**
- Confirmar que Prometheus tem dados: `curl http://localhost:9090/api/v1/query?query=k6_vus`
- Confirmar que Grafana está conectado a Prometheus: Settings → Data Sources → Prometheus (deve estar Green)
- Confirmar que o teste k6 foi executado (métricas só aparecem pós-execução)
- Confirmar que time range do dashboard inclui momento do teste (default `now-30m`, suficiente para testes recentes)

### Métricas NestJS não aparecem em Joins Poliglotas

**Problema:** Seção "Joins Poliglotas" está vazia.

**Solução:**
- Confirmar que `LoggingInterceptor` está instalado em `main.ts`
- Confirmar que histogram `http_request_duration_seconds` foi registrado: `curl http://localhost:3000/metrics | grep http_request_duration_seconds`
- Confirmar que as requisições estão sendo feitas para os endpoints corretos (`POST /atendimentos`, `GET /atendimentos/:id`)
- Confirmar que path está sendo normalizado corretamente (ex: `/atendimentos/:id`, não `/atendimentos/uuid-real`)

### Teste k6 passa mas Grafana mostra taxa de erros

**Problema:** k6 reporta 0% erros, mas Grafana mostra `k6_http_req_failed_rate > 0`.

**Solução:**
- Verificar se há checks falhando: em Grafana, painel "Checks k6 — % Passando"
- Verificar logs do k6: último output (summary) antes de terminar
- Possível: checks verificam latência, e algumas requisições foram lentas (mas não falharam com 5xx)

### docker-compose porta conflict

**Problema:** Erro ao fazer `docker compose up -d` — porta 3000, 3005, 9090 já em uso.

**Solução:**
- Listar containers rodando: `docker ps`
- Parar containers conflitantes: `docker stop <container-id>`
- Ou editar `docker-compose.yml` para usar portas diferentes (ex: `3001:3000` para app, `3006:3000` para Grafana)

### Prometheus scrape falha (target red)

**Problema:** Prometheus UI mostra target `app-monolito:3000` como "Down" (vermelho).

**Solução:**
- Confirmar que NestJS está rodando: `docker exec -it app_nestjs_monolito sh` e verificar logs
- Confirmar que `/metrics` endpoint está respondendo: `docker exec -it app_nestjs_monolito curl localhost:3000/metrics | head`
- Confirmar que Docker DNS resolve `app-monolito`: `docker exec -it prometheus_pep sh` → `ping app-monolito`

---

## 8. Pontos de Atenção e Limitações

### tcc-pep-esp-ms.json está vazio

O arquivo `grafana/provisioning/dashboards/tcc-pep-esp-ms.json` existe mas contém 0 bytes. Reservado para análise especializada de microsserviços, nunca foi implementado. Se necessário criar um novo dashboard para MS, copiar estrutura de `tcc-pep-mono-ms-compara.json` e adaptar queries.

### Scripts k6 não possuem setup() para cenario-mono-ms.js

O script comparativo (`cenario-mono-ms.js`) não cria dados pré-teste. Assume que IDs de médico e paciente já existem. Isso requer execução prévia de `cenario-emergencia.js` ou criação manual de dados via API.

### Normalização de Path no LoggingInterceptor

O interceptor usa `req.route?.path` (template de rota) para agregar métricas. Isso significa:
- `/atendimentos/uuid-1`, `/atendimentos/uuid-2`, `/atendimentos/uuid-3` → todos agregados como `/atendimentos/:id`
- Essencial para reduzir cardinalidade (evitar explosão de séries no Prometheus)
- **Mas:** Path deve estar registrado em NestJS (não strings aleatórias)

### Sem Autenticação em /metrics

O endpoint `/metrics` é público (sem autenticação). Em produção, proteger com:
- Guard customizado: `@UseGuards(PrometheusGuard)`
- Proxy (nginx/reverse-proxy) com auth
- Network isolation (Prometheus em rede interna)

### Retenção de Dados — 7 dias

Prometheus mantém dados por 7 dias. Testes executados há mais de 7 dias desaparecem. Para histórico longo:
- Usar Prometheus com armazenamento remoto (cortex, thanos)
- Exportar métricas regularmente para arquivo externo
- Aumentar `--storage.tsdb.retention.time` (consome mais disco)

---

## 9. Comandos Rápidos

### Startup

```bash
# Subir toda infra
docker compose up -d

# Aguardar readiness (30s aproximadamente)
sleep 30

# Verificar status
docker compose ps

# Logs em tempo real
docker compose logs -f
```

### Testes k6

> Sempre use `--out experimental-prometheus-rw` para que VUs, throughput, erros e checks apareçam no Grafana.

```bash
# Entrar no container k6
docker exec -it k6_pep sh

# Listar scripts disponíveis
ls /scripts

# Executar Cenário 1 (Normal)
k6 run --out experimental-prometheus-rw /scripts/cenario-emergencia.js

# Executar Cenário 2 (Dia Corrido)
k6 run --out experimental-prometheus-rw -e SCENARIO=2 /scripts/cenario-emergencia.js

# Executar Cenário 3 (Emergência)
k6 run --out experimental-prometheus-rw -e SCENARIO=3 /scripts/cenario-emergencia.js

# Comparativo Monolito vs MS
k6 run --out experimental-prometheus-rw \
       -e MONO_URL=http://app-monolito:3000 \
       -e MEDICO_ID=<uuid> \
       -e PACIENTE_ID=<uuid> \
       /scripts/cenario-mono-ms.js

# Sair do container
exit
```

### Verificações

```bash
# Prometheus: listar targets
curl http://localhost:9090/api/v1/targets

# Prometheus: query de exemplo
curl 'http://localhost:9090/api/v1/query?query=k6_vus'

# NestJS: conferir métricas
curl http://localhost:3000/metrics | head -50

# Grafana: acesso
# Browser: http://localhost:3005 (admin/admin)

# Logs de containers
docker logs app_nestjs_monolito
docker logs prometheus_pep
docker logs grafana_pep
```

### Limpeza

```bash
# Parar containers (mantém volumes)
docker compose down

# Parar e remover volumes (limpa dados)
docker compose down -v

# Reiniciar tudo
docker compose restart
```

---

## Referência Rápida: Métricas e Queries

### Métricas NestJS (para Histogramas)

```
# Latência de endpoint específico (em segundos)
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{path="/atendimentos/:id",method="GET"}[1m])) by (le))

# Total de requisições (counter)
increase(http_requests_total{path="/medicos"}[5m])

# Taxa de erro por endpoint
rate(http_requests_total{status=~"5.."}[1m]) / rate(http_requests_total[1m])
```

### Métricas k6 (pré-calculadas)

```
# VUs ativos agora
k6_vus{test_scenario="normal"}

# Throughput (req/s)
sum(rate(k6_http_reqs_total{test_scenario="normal"}[30s]))

# Taxa de falha (%)
(avg(k6_http_req_failed_rate{test_scenario="normal"}) || vector(0)) * 100

# P95 latência (em segundos, converter para ms × 1000)
k6_http_req_duration_p95{test_scenario="normal"} * 1000

# Taxa de sucesso de checks
k6_checks_rate{test_scenario="normal"}
```

---

## Próximas Ações

Com este documento, futuros trabalhos podem:

1. **Adicionar novo cenário k6:** Copiar `cenario-emergencia.js`, adaptar stages/thresholds/tag `test_scenario`
2. **Criar novo dashboard:** Exportar JSON de dashboard existente em Grafana, editar filtros de `test_scenario` ou `arquitetura`, re-importar
3. **Modificar SLOs:** Alterar valores em `k6-scripts/` (stages, thresholds) e em dashboards Grafana (visual thresholds)
4. **Integrar métricas customizadas:** Adicionar nova métrica em `LoggingInterceptor` (novo Histogram ou Counter), expor em `/metrics`, usar em Grafana
5. **Exportar dados:** Usar `curl` contra Prometheus HTTP API ou ferramentas como `prometheus_backup.sh` para extrair dados históricos

Todos os fluxos, configurações e comportamentos estão documentados acima. Referir a seções específicas ao detalhar novos pedidos.
