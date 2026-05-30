# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NestJS monolithic backend for an Electronic Patient Record system (PEP — Prontuário Eletrônico do Paciente). This is a TCC (undergraduate thesis) project benchmarking **polyglot persistence** in a healthcare emergency triage context, with full LGPD (Brazilian GDPR) compliance infrastructure.

## Commands

```bash
# Development
npm run start:dev        # Hot-reload dev server
npm run start:debug      # Dev server with debugger attached

# Build & Production
npm run build            # Compile TypeScript → dist/
npm run start:prod       # Run compiled output

# Code Quality
npm run lint             # ESLint with auto-fix
npm run format           # Prettier formatting

# Tests
npm run test             # Unit tests (src/**/*.spec.ts)
npm run test:watch       # Watch mode
npm run test:cov         # With coverage report
npm run test:e2e         # E2E tests (test/**/*.e2e-spec.ts)

# Docker Infrastructure (required before running locally)
docker compose up -d     # Start PostgreSQL, MongoDB, Prometheus, Grafana, k6
docker compose down      # Stop all services

# Load Testing (after docker compose up)
docker exec -it k6_pep sh
k6 run /scripts/cenario-emergencia.js
```

**Service URLs after `docker compose up`:**
- API: http://localhost:3000
- Swagger: http://localhost:3000/api
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3005 (admin/admin)

## Architecture

### Polyglot Persistence

The system uses two databases with deliberate separation of concerns:
- **PostgreSQL** (TypeORM): Structured, transactional data — `Paciente`, `Medico`, `Atendimento`, `LogAuditoria`
- **MongoDB** (Mongoose): Flexible schema clinical documents — `HistoricoClinico`, `ConsultaLaudo`

### Module Structure

Six domain modules under `src/modules/`, each following a layered pattern:
```
module/
├── controllers/    # HTTP handlers
├── services/       # Business logic + cross-module orchestration
├── repositories/   # Data access wrappers (TypeORM or Mongoose)
├── dto/            # class-validator DTOs
├── entities/       # TypeORM entities (PostgreSQL modules)
└── schemas/        # Mongoose schemas (MongoDB modules)
```

### Key Cross-Cutting Patterns

**Dual-Write on Admission (`AtendimentosService.create`):** Creating an `Atendimento` triggers four writes in sequence: (1) PostgreSQL Atendimento, (2) MongoDB HistoricoClinico (idempotent via `criarOuObter`), (3) MongoDB ConsultaLaudo of type TRIAGEM, (4) PostgreSQL LogAuditoria. No distributed transaction — if MongoDB writes fail after PostgreSQL succeeds, the service throws and the inconsistency must be resolved manually.

**Polyglot Join (`AtendimentosService.findOne`):** Reading a single admission fetches from both databases and merges at the application level. Returns `{ ...atendimento, consultasLaudos: [...] }`.

**Allergy Propagation:** When a `ConsultaLaudo` identifies new allergies (`novasAlergiasIdentificadas`), `ConsultasLaudosService` automatically pushes them to the patient's `HistoricoClinico` via MongoDB `$push`.

**Audit Logging:** `LogsAuditoriaService` is exported from `LogsAuditoriaModule` and injected into all other services. Audit creation is fire-and-forget inside try-catch — failures never block the main flow.

### LGPD Compliance

- **Patient names**: AES-256-GCM encrypted at save, decrypted at retrieval — handled in `PacientesService` using `src/common/utils/crypto.util.ts`
- **CPF**: Stored as HMAC-SHA256 (`cpfHash`), enabling lookups without plaintext — use `hashCpf()` from crypto.util
- **Clinical document integrity**: SHA-256 hash stored in `hashIntegridade` field on HistoricoClinico and ConsultaLaudo documents
- **LGPD metadata**: All MongoDB documents carry a `metadadosLgpd` embedded object (consent timestamp, treatment purpose, anonymization flag)

### Module Dependency Graph

`LogsAuditoriaModule` is a utility consumed by all other modules. The core import chain is:
```
AtendimentosModule → ConsultasLaudosModule → HistoricoClinicosModule
PacientesModule   → AtendimentosModule + HistoricoClinicosModule
MedicosModule     → AtendimentosModule + ConsultasLaudosModule
```

### Global Infrastructure (`src/main.ts` + `src/app.module.ts`)

- `ValidationPipe` (whitelist + transform) applied globally
- `HttpExceptionFilter` — structured error responses with timestamp/path/method
- `LoggingInterceptor` — registers Prometheus HTTP duration histograms; uses a singleton guard to prevent duplicate metric registration
- Swagger/OpenAPI auto-generated at `/api`
- Prometheus metrics exposed at `/metrics` (scraped every 5s)

### Database Configuration

- TypeORM: `src/config/database/typeorm.config.ts` — `synchronize: true` (auto-schema sync; no explicit migrations run in dev)
- Mongoose: `src/config/database/mongoose.config.ts` — debug logging enabled in development
- PostgreSQL schema initialized from `migrations/postgres/01-schema.sql` on first container start
- MongoDB initialized from `migrations/mongo/init-mongo.js`

### Environment Variables

Copy `.env.example` to `.env`. Key variables: `POSTGRES_*`, `MONGO_*`, `CRYPTO_SECRET` (32-byte hex key for AES-256-GCM), `NODE_ENV`, `PORT`.

### Load Testing Scenarios (k6-scripts/)

- `cenario-emergencia.js` — ramp 30 VUs (30s up → 2m sustain → 30s down), SLO targets per join type
- `cenario-mono-ms.js` — Side-by-side monolith vs microservices comparison

Grafana dashboards provisioned automatically from `grafana/dashboards/`; datasource auto-configured from `grafana/provisioning/`.

### k6 Check Failures vs HTTP Errors

The Grafana "Taxa de Erros (%)" panel counts **k6 SLO check failures** (latency assertions like `latencia < 800ms`), NOT HTTP 4xx/5xx errors from the app. The app returns only 200/201 under normal load. A high error % in Grafana means SLO thresholds are being breached, not that the API is failing.

## Performance Optimizations Applied (TCC Benchmark Context)

These fixes were applied to remove implementation bugs without changing the architectural design. The goal: system handles ~30 VUs well; ~80 VUs reveals the true polyglot bottleneck.

### 1. Fire-and-forget audit logs
**Files:** all `*.service.ts` files that call `logsAuditoriaService.registrar()`

Removed `await` from all audit log calls across `AtendimentosService`, `ConsultasLaudosService`, `PacientesService`, `MedicosService`. Audit failures are caught internally by the service — they must never block the main HTTP response. This matches what CLAUDE.md already documented as the intended pattern.

### 2. Parallel polyglot read (`findOne`)
**File:** `src/modules/atendimentos/services/atendimentos.service.ts`

Changed `findOne` from sequential (PG then MongoDB) to `Promise.all([PG, MongoDB])`. The two queries have no dependency on each other, so running them in parallel cuts the read latency roughly in half.

### 3. Atomic upsert for `criarOuObter`
**File:** `src/modules/historico-clinicos/repositories/historico-clinicos.repository.ts`

Replaced the `findByPacienteId → create` pattern (2 round-trips + race condition under concurrent load) with a single `findOneAndUpdate` using `{ upsert: true, $setOnInsert }`. This is atomic in MongoDB and removes one full network round-trip from the dual-write critical path.

### 4. Connection pool tuning
- **TypeORM** (`src/config/database/typeorm.config.ts`): `extra.max = 20` (was default 10)
- **Mongoose** (`src/config/database/mongoose.config.ts`): `maxPoolSize: 20` (was default 5 — the most impactful fix; with 5 connections and 30 VUs each doing 2-3 Mongo ops, a queue of ~18 requests forms before reaching the DB)

### 5. PostgreSQL memory tuning
**File:** `docker-compose.yml` — `postgres-pep` service

Added startup flags: `shared_buffers=256MB`, `effective_cache_size=768MB`, `max_connections=100`, `work_mem=4MB`. Requires `docker compose restart postgres-pep` to take effect.

### Rebuild After Changes

```bash
docker compose up -d --build app-monolito   # rebuild NestJS app
docker compose restart postgres-pep          # apply PG memory config
docker compose restart prometheus            # fix out-of-order sample errors if present
```

### What Remains as Intentional Architecture (Not Bugs)

- **Sequential dual-write chain**: `Atendimento (PG) → HistoricoClinico (MongoDB) → ConsultaLaudo (MongoDB) → LogAuditoria (PG)` — still sequential because there are data dependencies between steps. This sequential cost is the measurable price of polyglot persistence and is the central finding of the TCC.
- **No distributed transaction**: inconsistency on partial failure must be resolved manually — deliberate simplification for the academic scope.
