# 📊 Benchmarking de Persistência Poliglota em Prontuários Eletrônicos

Este repositório contém os artefatos de software, infraestrutura e scripts de teste desenvolvidos para o Trabalho de Conclusão de Curso (TCC) de Engenharia da Computação no Centro Universitário UniFacens.

**Título do Projeto:** Benchmarking de Persistência Poliglota: Avaliação do Desempenho de Arquiteturas Monolíticas e Baseadas em Microsserviços no Acesso a Prontuários Eletrônicos em Situações de Emergência.

## 👥 Equipe e Orientação
* **Felipe Rusig de Paiva** (RA: 212031)
* **Guilherme Massayuki Yokoda de Moraes** (RA: 223618)
* **Leonardo Rossi de Oliveira** (RA: 222410) - Líder
* **Orientador:** Prof. Marco Antonio Montebello Junior

## 🎯 Objetivo da Pesquisa
O projeto visa avaliar experimentalmente o desempenho de uma arquitetura monolítica utilizando **Persistência Poliglota** (uso de diferentes tecnologias de banco de dados conforme as características dos dados). O foco é a resiliência e a mitigação de alta latência no acesso a Prontuários Eletrônicos de Pacientes (PEP) durante picos de emergência médica.

Este trabalho está alinhado aos Objetivos de Desenvolvimento Sustentável (ODS) da ONU:
* **ODS 3 (Saúde e Bem-Estar):** Redução de latências sistêmicas no acesso a dados críticos que podem custar vidas.
* **ODS 9 (Indústria, Inovação e Infraestrutura):** Promoção de infraestruturas de software resilientes e escaláveis.

---

## 🏗️ Arquitetura Monolítica Poliglota

Este protótipo implementa uma **aplicação monolítica centralizada** que se comunica com múltiplos bancos de dados especializados:

### **Modelo de Dados**
```
┌─────────────────────────────────────────────┐
│   NestJS Monolith (Node.js + TypeScript)    │
├─────────────────────────────────────────────┤
│                                             │
│  ├─ Atendimentos (Triagem)                  │
│  ├─ Pacientes (Cadastro)                    │
│  ├─ Médicos (Profissionais)                 │
│  ├─ Consultas & Laudos (Registros Médicos)  │
│  ├─ Histórico Clínico (Série Temporal)      │
│  └─ Logs de Auditoria (Compliance)          │
│                                             │
└─────────────────────────────────────────────┘
         ↙           ↓           ↘
    PostgreSQL    MongoDB    (Prometheus)
    Triagem &     Laudos &       Métricas
    Pacientes    Histórico
```

### **Persistência Poliglota**
| Entidade | Banco | Razão |
|----------|-------|-------|
| **Atendimentos, Pacientes, Médicos** | PostgreSQL | ACID, relacionamentos estruturados, triagem crítica |
| **Consultas, Laudos, Histórico Clínico** | MongoDB | Flexibilidade schema, crescimento não-previsível, registros semiestruturados |
| **Logs de Auditoria** | PostgreSQL | Rastreabilidade, conformidade LGPD |
| **Métricas Operacionais** | Prometheus | Time-series, alertas em tempo real |

---

## 📦 Estrutura de Módulos

```
src/modules/
├── atendimentos/              # Triagem e manejo de emergências
│   ├── controllers/
│   ├── services/              # Lógica de negócio
│   ├── repositories/          # Acesso a dados PostgreSQL
│   ├── entities/              # Tabelas PostgreSQL
│   └── dto/                   # DTOs de requisição
│
├── pacientes/                 # Cadastro e gerenciamento de pacientes
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── entities/
│   └── dto/
│
├── medicos/                   # Profissionais de saúde
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── entities/
│   └── dto/
│
├── consultas-laudos/          # Registros médicos (MongoDB)
│   ├── controllers/
│   ├── services/              # Orquestra MongoDB + Histórico
│   ├── repositories/          # Acesso a dados MongoDB
│   ├── schemas/               # Schemas MongoDB com validação
│   └── dto/                   # DTOs com prescrições e alergias
│
├── historico-clinicos/        # Série temporal de saúde (MongoDB)
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── schemas/
│   └── dto/
│
└── logs-auditoria/            # Rastreamento de ações (PostgreSQL)
    ├── controllers/
    ├── services/
    ├── repositories/
    ├── entities/
    └── dto/
```

---

## 🚀 Principais Endpoints da API

### **Triagem (Atendimentos)**
```
POST   /atendimentos              # Criar nova triagem
GET    /atendimentos              # Listar todas as triagens
GET    /atendimentos/:id          # Detalhes da triagem (Join PG + MDB)
PUT    /atendimentos/:id          # Atualizar triagem
DELETE /atendimentos/:id          # Cancelar triagem
GET    /atendimentos/paciente/:pacienteId  # Triagens do paciente
```

### **Pacientes**
```
POST   /pacientes                 # Cadastrar paciente
GET    /pacientes                 # Listar pacientes
GET    /pacientes/:id             # Dados do paciente
PUT    /pacientes/:id             # Atualizar cadastro
DELETE /pacientes/:id             # Deletar paciente
```

### **Médicos**
```
POST   /medicos                   # Cadastrar médico
GET    /medicos                   # Listar médicos
GET    /medicos/:id               # Dados do médico
PUT    /medicos/:id               # Atualizar médico
```

### **Consultas e Laudos (MongoDB)**
```
POST   /consultas-laudos          # Registrar consulta/laudo com prescrições
GET    /consultas-laudos          # Listar todos os registros
GET    /consultas-laudos/atendimento/:atendimentoId
GET    /consultas-laudos/paciente/:pacienteId  # ⭐ Busca otimizada por índice
```

### **Histórico Clínico (MongoDB)**
```
GET    /historico-clinicos/paciente/:pacienteId
PUT    /historico-clinicos/alergias/:pacienteId  # Adicionar alergias
GET    /historico-clinicos/paciente/:pacienteId/alergias
```

### **Logs de Auditoria**
```
GET    /logs-auditoria                           # Todos os logs
GET    /logs-auditoria/atendimento/:atendimentoId
GET    /logs-auditoria/paciente/:pacienteId
GET    /logs-auditoria/usuario/:usuarioId
```

---

## 🔄 Fluxo de Dados - Cenário de Emergência

```
1. Paciente chega na emergência
   └─> POST /atendimentos
       {
         pacienteId: "uuid-001",
         queixaPrincipal: "Dor no peito",
         classificacaoRisco: "VERMELHO",
         medicoTriagemId: "medico-001"
       }

2. Sistema persiste em paralelo (Dual-Write Pattern):
   ├─ [PostgreSQL] Atendimento + Paciente (ACID, estruturado)
   └─ [MongoDB] Documento de TRIAGEM (schema flexível)

3. Histórico clínico é criado/recuperado automaticamente
   └─> MongoDB: Histórico com metadados LGPD
   
4. Auditoria é registrada automaticamente
   └─> [PostgreSQL] Log de ação + IP + usuário + timestamp

5. Médico registra consulta/laudo com prescrições
   └─> POST /consultas-laudos
       {
         atendimentoId: "...",
         pacienteId: "uuid-001",
         medicoId: "medico-001",
         tipoRegistro: "CONSULTA",
         descricaoClinica: "...",
         prescricoes: [...],
         examesAnexos: [...],
         novasAlergiasIdentificadas: [...]
       }

6. Alergias propagam automaticamente ao histórico clínico
   └─> Service chama historicoClinicosService.adicionarAlergias()
   └─> Histórico atualizado com novas alergias (LGPD-compliant)

7. Relatório de emergência consultado em tempo real
   └─> GET /atendimentos/:id
   └─> Response contém dados estruturados (PG) + documentos (MDB)
   └─> Latência otimizada com índices em paciente_id
```

---

## 📊 Modelos de Dados

### **PostgreSQL - Schema Relacional**

#### Pacientes
```sql
CREATE TABLE pacientes (
  id UUID PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cpf VARCHAR(11) UNIQUE,
  data_nascimento DATE,
  genero CHAR(1),
  telefone VARCHAR(20),
  email VARCHAR(100),
  endereco TEXT,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);
```

#### Atendimentos (Triagem)
```sql
CREATE TABLE atendimentos (
  id UUID PRIMARY KEY,
  paciente_id UUID NOT NULL REFERENCES pacientes(id),
  medico_triagem_id UUID NOT NULL REFERENCES medicos(id),
  queixa_principal VARCHAR(500),
  classificacao_risco VARCHAR(20), -- VERMELHO, AMARELO, VERDE, AZUL
  data_atendimento TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50), -- ABERTO, EM_ANDAMENTO, FINALIZADO, CANCELADO
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_atendimentos_paciente ON atendimentos(paciente_id);
CREATE INDEX idx_atendimentos_medico ON atendimentos(medico_triagem_id);
```

#### Médicos
```sql
CREATE TABLE medicos (
  id UUID PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  crm VARCHAR(20) UNIQUE NOT NULL,
  especialidade VARCHAR(100),
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT NOW()
);
```

#### Logs de Auditoria
```sql
CREATE TABLE logs_auditoria (
  id UUID PRIMARY KEY,
  atendimento_id UUID REFERENCES atendimentos(id),
  acao_realizada VARCHAR(500),
  ip_origem VARCHAR(45),
  entidade_afetada VARCHAR(100),
  entidade_id VARCHAR(100),
  usuario_responsavel UUID,
  data_acao TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_logs_atendimento ON logs_auditoria(atendimento_id);
CREATE INDEX idx_logs_usuario ON logs_auditoria(usuario_responsavel);
CREATE INDEX idx_logs_data ON logs_auditoria(data_acao);
```

### **MongoDB - Documentos Semiestruturados**

#### Histórico Clínico
```javascript
{
  _id: ObjectId,
  paciente_id: "uuid-001",  // FK lógica ao PostgreSQL
  alergias_conhecidas: [
    { substancia: "Penicilina", severidade: "grave", reacao: "anafilaxia" }
  ],
  comorbidades_previas: ["Diabetes", "Hipertensão"],
  tipos_sanguineos_incompativeis: ["O-"],
  metadados_lgpd: {
    consentimento_em: ISODate("2024-01-15"),
    retencao_maxima: 2555,  // dias até exclusão automática
    hash_integridade: "sha256_hash_here",
    ultima_revisao: ISODate("2024-05-19"),
    consentimento_coletado: true,
    finalidade_tratamento: "Assistência médica e continuidade do cuidado",
    responsavel_tratamento: "medico-001",
    anonimizado: false
  },
  hash_integridade: "sha256_hash",
  criado_em: ISODate("2024-01-15"),
  atualizado_em: ISODate("2024-05-19")
}
```

#### Consultas e Laudos
```javascript
{
  _id: ObjectId,
  atendimento_id: "uuid-123",
  historico_id: ObjectId("..."),
  paciente_id: "uuid-001",  // Índice para otimização
  medico_id: "medico-001",
  data_registro: ISODate("2024-05-19T20:30:00Z"),
  tipo_registro: "CONSULTA",  // TRIAGEM, CONSULTA, EVOLUCAO, LAUDO, PRESCRICAO, ALTA
  descricao_clinica: "Paciente apresenta cefaleia frontal...",
  prescricoes: [
    {
      medicamento: "Dipirona",
      dose: "500mg",
      frequencia: "A cada 8 horas",
      duracao: "7 dias"
    }
  ],
  exames_anexos: [
    {
      tipo: "Raio-X",
      descricao: "Raio-X de tórax",
      url_anexo: "https://...",
      data_realizacao: ISODate("2024-05-19")
    }
  ],
  novas_alergias_identificadas: [
    {
      substancia: "Iodo",
      severidade: "moderada",
      reacao: "coceira e urticária"
    }
  ],
  hash_integridade: "sha256_hash",
  criado_em: ISODate("2024-05-19T20:30:00Z"),
  atualizado_em: ISODate("2024-05-19T20:35:00Z")
}
```

**Índices MongoDB:**
```javascript
db.historico_clinicos.createIndex({ paciente_id: 1 }, { unique: true });
db.historico_clinicos.createIndex({ "alergias_conhecidas.severidade": 1 });

db.consultas_laudos.createIndex({ atendimento_id: 1 });
db.consultas_laudos.createIndex({ paciente_id: 1 });  // ⭐ Otimiza buscas por paciente
db.consultas_laudos.createIndex({ tipo_registro: 1 });
db.consultas_laudos.createIndex({ medico_id: 1, data_registro: -1 });
```

---

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| **Runtime** | Node.js | 20+ |
| **Framework** | NestJS | Latest |
| **Linguagem** | TypeScript | 5+ |
| **BD Relacional** | PostgreSQL | 15-Alpine |
| **BD NoSQL** | MongoDB | 6.0 |
| **Monitoramento** | Prometheus | Latest |
| **Visualização** | Grafana | Latest |
| **Testes de Carga** | Grafana k6 | Latest |
| **Containerização** | Docker & Docker Compose | Latest |

---

## 📋 Como Executar o Projeto Localmente

### **1. Pré-requisitos**
Certifique-se de que os seguintes softwares estão instalados:
* **Node.js** (versão 20 ou superior recomendada)
* **NPM** (gerenciador de pacotes, já incluído com Node.js)
* **Docker Desktop** (necessário para execução dos bancos de dados)
* **Git** (para clonar o repositório)

### **2. Clonando o Repositório**
```bash
git clone https://github.com/seu-usuario/tcc-prontuario-poliglota-2026.git
cd tcc-pep-backend-monolito
```

### **3. Configuração das Variáveis de Ambiente**
Crie um arquivo `.env` na raiz do projeto:
```dotenv
# PostgreSQL
POSTGRES_USER=pep_user
POSTGRES_PASSWORD=pep_secure_password
POSTGRES_DB=pep_relacional
POSTGRES_PORT=5432

# MongoDB
MONGO_INITDB_ROOT_USERNAME=pep_admin
MONGO_INITDB_ROOT_PASSWORD=pep_mongo_password
MONGO_PORT=27017
MONGO_INITDB_DATABASE=pep_nao_relacional

# Node.js
NODE_ENV=development
PORT=3000
```

### **4. Instalação das Dependências**
```bash
npm install
```

### **5. Inicialização da Infraestrutura (Docker Compose)**
```bash
# Subir todos os containers (PostgreSQL, MongoDB, Prometheus, Grafana, K6)
docker compose up -d

# Verificar status
docker compose ps

# Logs em tempo real
docker compose logs -f app-monolito
```

**Serviços disponíveis após inicialização:**
| Serviço | URL | Credenciais |
|---------|-----|-------------|
| Aplicação NestJS | `http://localhost:3000` | N/A |
| Swagger (API Docs) | `http://localhost:3000/api` | N/A |
| Prometheus | `http://localhost:9090` | N/A |
| Grafana | `http://localhost:3005` | `admin:admin` |
| MongoDB | `localhost:27017` | Ver `.env` |
| PostgreSQL | `localhost:5432` | Ver `.env` |

### **6. Execução da Aplicação**
```bash
# Modo desenvolvimento (com hot reload)
npm run start:dev

# Modo produção
npm run build
npm run start:prod
```

### **7. Verificar Saúde da Aplicação**
```bash
curl http://localhost:3000/health
```

---

## 🧪 Testes e Benchmarking

### **Testes Unitários**
```bash
npm run test
```

### **Testes E2E**
```bash
npm run test:e2e
```

### **Testes de Carga com k6**
Os scripts de k6 simulam cenários de emergência com múltiplas requisições simultâneas:

```bash
# Entrar no container k6
docker exec -it k6_pep sh

# Executar cenário de emergência
k6 run /scripts/cenario-emergencia.js

# Resultado: Métricas enviadas para Prometheus e visualizadas em Grafana
```

**Cenário incluído:**
- `cenario-emergencia.js` - Simula 100+ pacientes chegando simultaneamente, com múltiplas triagens e consultas/laudos

**Exemplo de output k6:**
```
scenarios: (100.00%) 1 emergency
     data_received..................: 1.5 MB  25 kB/s
     data_sent......................: 980 kB  16 kB/s
     http_req_blocked...............: avg=5ms   p(90)=8ms
     http_req_connect...............: avg=2ms   p(90)=3ms
     http_req_duration..............: avg=120ms p(90)=250ms
     http_req_failed................: 0.50%
     http_reqs......................: 2500    42.2/s
     iteration_duration.............: avg=150ms p(90)=300ms
```

---

## 📊 Monitoramento e Observabilidade

### **Prometheus**
Coleta métricas da aplicação NestJS em tempo real:
- Latência de requisições HTTP
- Throughput (requisições/segundo)
- Taxa de erro
- Duração de queries ao banco de dados
- Número de conexões ativas

**Acesse:** `http://localhost:9090`

**Queries úteis:**
```
# Latência P99 por endpoint
histogram_quantile(0.99, http_request_duration_seconds_bucket)

# Taxa de erro
rate(http_requests_failed_total[5m])

# Throughput
rate(http_requests_total[1m])
```

### **Grafana**
Dashboard pré-configurado para visualizar:
- **Dashboard Principal (`pep-monolito.json`):** Métrica de latência, disponibilidade, erros
- Correlação entre PostgreSQL e MongoDB
- Taxa de sucesso de operações poliglota
- Performance por tipo de endpoint

**Acesse:** `http://localhost:3005` (credenciais: `admin:admin`)

**Dashboards inclusos:**
- Visão geral de saúde da aplicação
- Latência por endpoint
- Taxa de erro por módulo
- Performance PostgreSQL vs MongoDB
- Throughput em tempo real

---

## 🔒 Segurança e Conformidade LGPD

### **LGPD (Lei Geral de Proteção de Dados)**
- ✅ Metadados de consentimento armazenados para cada paciente
- ✅ Hash de integridade em registros sensíveis
- ✅ Logs de auditoria de todas as ações (quem, quando, o quê)
- ✅ Suporte a exclusão em cascata (`removeByPacienteId`)
- ✅ Retenção máxima de dados configurável

### **Implementação de Auditoria**
Toda ação em dados sensíveis é registrada:
```typescript
// Exemplo no ConsultasLaudosService
await this.logsAuditoriaService.registrar({
  atendimentoId: dto.atendimentoId,
  acaoRealizada: `Consulta registrada pelo médico ${dto.medicoId}`,
  ipOrigem: this.extractIp(req),
  entidadeAfetada: 'ConsultaLaudo',
  entidadeId: documento._id.toString(),
  usuarioResponsavel: dto.medicoId,
});
```

### **Criptografia**
- Senhas hasheadas com bcrypt (raiz 12)
- Documentos MongoDB com hash SHA-256 para integridade
- Conexões SSL/TLS para bancos em produção

### **Consultas Auditoria**
```sql
-- Todas as ações do paciente X
SELECT * FROM logs_auditoria 
WHERE atendimento_id IN (
  SELECT id FROM atendimentos WHERE paciente_id = 'uuid-001'
) ORDER BY data_acao DESC;

-- Exclusão LGPD do paciente
DELETE FROM consultas_laudos WHERE paciente_id = 'uuid-001';
DELETE FROM historico_clinicos WHERE paciente_id = 'uuid-001';
DELETE FROM atendimentos WHERE paciente_id = 'uuid-001';
DELETE FROM pacientes WHERE id = 'uuid-001';
```

---

## 🛠️ Ferramentas Recomendadas

| Ferramenta | Propósito | Link |
|-----------|----------|------|
| **DBeaver** | Cliente universal de BD (PG + MongoDB) | https://dbeaver.io |
| **Postman** | Testes de API REST com automação | https://postman.com |
| **VS Code** | Editor com extensões para Node.js/Docker | https://code.visualstudio.com |
| **Docker Desktop** | Interface gráfica para containers | https://docker.com |
| **pgAdmin** | Admin web para PostgreSQL | https://pgadmin.org |
| **Compass** | Cliente GUI para MongoDB | https://mongodb.com/products/compass |
| **TablePlus** | Cliente BD multiplataforma | https://tableplus.com |
| **GitHub Desktop** | Git com interface gráfica | https://desktop.github.com |
| **Insomnia** | Alternativa ao Postman | https://insomnia.rest |

---

## 📁 Estrutura de Arquivo do Projeto

```
tcc-pep-backend-monolito/
├── src/
│   ├── main.ts                              # Entry point
│   ├── app.module.ts                        # Módulo raiz
│   ├── app.controller.ts
│   ├── app.service.ts
│   ├── common/
│   │   ├── filters/
│   │   │   └── HttpExceptionFilter.ts       # Tratamento global de erros
│   │   ├── interceptors/
│   │   │   └── LoggingInterceptor.ts        # Logging automático
│   │   └── utils/
│   │       └── crypto.util.ts               # Hash SHA-256
│   ├── config/
│   │   └── database/
│   │       ├── mongoose.config.ts           # Config MongoDB
│   │       └── typeorm.config.ts            # Config PostgreSQL
│   └── modules/
│       ├── atendimentos/
│       ├── pacientes/
│       ├── medicos/
│       ├── consultas-laudos/
│       ├── historico-clinicos/
│       └── logs-auditoria/
│
├── migrations/
│   ├── postgresSQL/
│   │   └── 01-schema.sql                    # Schema PostgreSQL (triagem, pacientes)
│   └── mongoDB/
│       └── init-mongo.js                    # Inicialização MongoDB com índices
│
├── grafana/
│   └── provisioning/
│       ├── dashboards/
│       │   ├── dashboards.yml               # Provisioning automático
│       │   └── pep-monolito.json            # Dashboard principal pré-configurado
│       └── datasources/
│           └── prometheus.yml               # Fonte de dados Prometheus
│
├── k6-scripts/
│   └── cenario-emergencia.js                # Teste de carga com k6
│
├── test/
│   ├── app.e2e-spec.ts
│   └── jest-e2e.json
│
├── docker-compose.yml                       # Orquestração de containers
├── dockerfile                               # Build da aplicação
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── nest-cli.json
├── .env.example
└── README.md                                # Este arquivo
```

---

## 🐛 Troubleshooting

| Problema | Solução |
|----------|---------|
| Docker não encontrado | Certifique-se de ter Docker Desktop instalado e rodando |
| Porta 3000 já em uso | Altere `PORT=3001` no `.env` ou finalize processo anterior |
| MongoDB sem conexão | Verifique credenciais no `.env` e se container está ativo (`docker compose ps`) |
| Migrations não executadas | Execute `docker compose down -v` e `docker compose up -d` |
| Hot reload não funciona | Reinicie com `npm run start:dev` |
| Erro de conexão PostgreSQL | Aguarde 5-10s para container inicializar, verifique credenciais |
| Grafana não mostra métricas | Aguarde 1-2 minutos para Prometheus coletar dados, verifique fonte de dados |

---

## 📈 Considerações de Performance

### **Dual-Write Pattern**
- Escrita síncrona em PostgreSQL (ACID)
- Escrita síncrona em MongoDB (flexibilidade)
- Eventual consistency garantida pelo schema

### **Índices Críticos**
```javascript
// ConsultasLaudos - Busca por paciente otimizada
db.consultas_laudos.createIndex({ paciente_id: 1 });

// Histórico Clínico - FK única por paciente
db.historico_clinicos.createIndex({ paciente_id: 1 }, { unique: true });

// Buscas por tipo de registro
db.consultas_laudos.createIndex({ tipo_registro: 1 });
```

### **Otimizações Implementadas**
- ✅ Repository pattern para separação de concerns
- ✅ Indexes em campos de busca frequente
- ✅ Lazy loading de relacionamentos
- ✅ Caching de histórico clínico
- ✅ Batching de operações de auditoria

---

## 📚 Referências e Conceitos

### **Persistência Poliglota**
Uso de múltiplos bancos de dados especializados em uma única aplicação, escolhendo a melhor ferramenta para cada tipo de dados.

**Benefícios:**
- ✅ Otimização por caso de uso
- ✅ Melhor performance
- ✅ Escalabilidade horizontal
- ✅ Flexibilidade arquitetural

### **LGPD - Lei Geral de Proteção de Dados**
- Consentimento informado
- Direito ao esquecimento
- Integridade e confidencialidade
- Rastreabilidade (auditoria)

### **Padrões Implementados**
- **Repository Pattern:** Abstração de acesso a dados
- **Dual-Write Pattern:** Escrita em múltiplos bancos
- **Service Layer:** Orquestração de lógica de negócio
- **DTO Pattern:** Validação de entrada/saída
- **Event-Driven:** Propagação de alergias via service

---

## 📞 Contato e Suporte

Para dúvidas ou contribuições, abra uma **Issue** no repositório ou entre em contato com os autores.

---

## 📜 Licença

Este projeto é parte do TCC de Engenharia da Computação no UniFacens - 2026.

---

**Centro Universitário UniFacens** — Engenharia da Computação — 2026
