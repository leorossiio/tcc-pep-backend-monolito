import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://app-monolito:3000';
const HEADERS  = { 'Content-Type': 'application/json' };

const SCENARIO = __ENV.SCENARIO || '1';

const SCENARIOS = {
  '1': {
    stages: [
      { duration: '30s', target: 50 },
      { duration: '2m',  target: 50 },
      { duration: '30s', target: 0  },
    ],
    thresholds: {
      http_req_duration: ['p(95)<800'],
      http_req_failed:   ['rate<0.01'],
    },
    scenarioName: 'normal',
  },
  '2': {
    stages: [
      { duration: '30s', target: 150 },
      { duration: '2m',  target: 150 },
      { duration: '30s', target: 0   },
    ],
    thresholds: {
      http_req_duration: ['p(95)<1200'],
      http_req_failed:   ['rate<0.05'],
    },
    scenarioName: 'dia-corrido',
  },
  '3': {
    stages: [
      { duration: '45s',   target: 300 },
      { duration: '1m30s', target: 300 },
      { duration: '45s',   target: 0   },
    ],
    thresholds: {
      http_req_duration: ['p(95)<3000'],
      http_req_failed:   ['rate<0.15'],
    },
    scenarioName: 'emergencia',
  },
};

const selected = SCENARIOS[SCENARIO];
if (!selected) fail(`Cenario invalido: SCENARIO=${SCENARIO}. Use 1 (Normal), 2 (Dia Corrido) ou 3 (Emergencia).`);

export const options = {
  stages: selected.stages,
  thresholds: selected.thresholds,
  tags: {
    test_scenario: selected.scenarioName,
    system_type: 'monolito',
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

// --- Metricas por operacao (exportadas em CSV pelo handleSummary) ------------
// Cada operacao registra: duracao (Trend, ms), taxa de erro (Rate) e taxa de
// cumprimento do SLO de latencia (Rate). Tudo vira coluna no CSV de resultados.
const OPS = [
  { key: 'op1', label: 'GET atendimento',          endpoint: 'GET /atendimentos/:id',                 expect: 200, slo: 500 },
  { key: 'op2', label: 'GET paciente',             endpoint: 'GET /pacientes/:id',                    expect: 200, slo: 500 },
  { key: 'op3', label: 'POST atendimento (dual-write)', endpoint: 'POST /atendimentos',               expect: 201, slo: 800 },
  { key: 'op4', label: 'GET atendimentos/medico',  endpoint: 'GET /medicos/:id/atendimentos',         expect: 200, slo: 700 },
  { key: 'op5', label: 'GET historico-completo',   endpoint: 'GET /pacientes/:id/historico-completo', expect: 200, slo: 700 },
  { key: 'op6', label: 'POST medico (baseline)',   endpoint: 'POST /medicos',                         expect: 201, slo: 500 },
];
const OP_BY_KEY = {};
const METRICS = {};
for (const o of OPS) {
  OP_BY_KEY[o.key] = o;
  METRICS[o.key] = {
    n: new Counter(`${o.key}_n`),
    dur: new Trend(`${o.key}_dur`, true),
    err: new Rate(`${o.key}_err`),
    slo: new Rate(`${o.key}_slo`),
  };
}
function registra(key, res) {
  const o = OP_BY_KEY[key];
  const m = METRICS[key];
  m.n.add(1);
  m.dur.add(res.timings.duration);
  m.err.add(res.status !== o.expect);
  m.slo.add(res.timings.duration < o.slo);
}

// --- Helpers -----------------------------------------------------------------

function postJson(url, body, params = {}) {
  return http.post(url, JSON.stringify(body), { headers: HEADERS, ...params });
}

function assertCreated(res, label) {
  if (res.status !== 201) {
    console.error(`[setup] FALHA ${label}: status=${res.status} body=${res.body}`);
    fail(`setup falhou: ${label}`);
  }
  return res.json();
}

// --- setup() -----------------------------------------------------------------

const POOL_MEDICOS   = Number(__ENV.POOL_MEDICOS   || 8);
const POOL_PACIENTES = Number(__ENV.POOL_PACIENTES || 40);

export function setup() {
  const base = Date.now();

  const medicoIds = [];
  for (let i = 0; i < POOL_MEDICOS; i++) {
    const m = assertCreated(
      postJson(`${BASE_URL}/medicos`, {
        nomeCompleto: `Dr. K6 Benchmark ${i}`,
        crm: `K6${base}_${i}/SP`,
        especialidade: 'Clinica Geral',
        ativo: true,
      }),
      `POST /medicos #${i}`,
    );
    medicoIds.push(m.id);
  }

  const registros = [];
  for (let i = 0; i < POOL_PACIENTES; i++) {
    const medicoId = medicoIds[i % medicoIds.length];
    const cpf = String(base + i).slice(-11).padStart(11, '0');

    const paciente = assertCreated(
      postJson(`${BASE_URL}/pacientes`, {
        nomeCompleto: `Paciente Benchmark K6 ${i}`,
        sexo: i % 2 === 0 ? 'M' : 'F',
        cpf,
        dataNascimento: '1990-01-15',
        consentimentoLgpd: true,
      }),
      `POST /pacientes #${i}`,
    );

    const atendimento = assertCreated(
      postJson(`${BASE_URL}/atendimentos`, {
        pacienteId: paciente.id,
        medicoTriagemId: medicoId,
        dataHoraEntrada: new Date().toISOString(),
        queixaPrincipal: 'Setup k6 - dor abdominal aguda',
        pressaoArterial: '120/80',
        frequenciaCardiaca: 80,
        saturacaoOxigenio: 98,
        temperaturaCorporal: 36.8,
        frequenciaRespiratoria: 16,
        classificacaoRisco: 'AMARELO',
      }),
      `POST /atendimentos #${i}`,
    );

    registros.push({
      pacienteId: paciente.id,
      medicoId,
      atendimentoId: atendimento.atendimentoId,
    });
  }

  console.log(`[setup] OK — ${medicoIds.length} medicos, ${registros.length} pacientes`);
  return { registros };
}

// --- default() ---------------------------------------------------------------

export default function (data) {
  const { pacienteId, medicoId, atendimentoId } =
    data.registros[(__VU - 1) % data.registros.length];

  // REQ 1: GET /atendimentos/{id}
  const r1 = http.get(`${BASE_URL}/atendimentos/${atendimentoId}`, { tags: { name: 'GET /atendimentos/:id' } });
  check(r1, {
    '[monolito] GET atendimento 200':    (r) => r.status === 200,
    '[monolito] GET atendimento <500ms': (r) => r.timings.duration < 500,
  });
  registra('op1', r1);
  sleep(1);

  // REQ 2: GET /pacientes/{id}
  const r2 = http.get(`${BASE_URL}/pacientes/${pacienteId}`, { tags: { name: 'GET /pacientes/:id' } });
  check(r2, {
    '[monolito] GET paciente 200':    (r) => r.status === 200,
    '[monolito] GET paciente <500ms': (r) => r.timings.duration < 500,
  });
  registra('op2', r2);
  sleep(1);

  // REQ 3: POST /atendimentos — dual-write (PG + MongoDB)
  const r3 = postJson(`${BASE_URL}/atendimentos`, {
    pacienteId,
    medicoTriagemId: medicoId,
    dataHoraEntrada: new Date().toISOString(),
    queixaPrincipal: `VU ${__VU} iter ${__ITER} — dor toracica intensa`,
    pressaoArterial: '150/95',
    frequenciaCardiaca: 110,
    saturacaoOxigenio: 94,
    temperaturaCorporal: 38.1,
    frequenciaRespiratoria: 22,
    classificacaoRisco: 'VERMELHO',
  }, { tags: { name: 'POST /atendimentos' } });
  check(r3, {
    '[monolito] POST atendimento 201':    (r) => r.status === 201,
    '[monolito] POST atendimento <800ms': (r) => r.timings.duration < 800,
  });
  registra('op3', r3);
  sleep(1);

  // REQ 4: "triagens do médico" — equivale ao GET /atendimentos/medico/:id do MS.
  // No monolito a operação existe como GET /medicos/:id/atendimentos (médico + atendimentos com laudos, PG→MDB).
  const r4 = http.get(`${BASE_URL}/medicos/${medicoId}/atendimentos`, { tags: { name: 'GET /medicos/:id/atendimentos' } });
  check(r4, {
    '[monolito] GET atendimentos/medico 200':    (r) => r.status === 200,
    '[monolito] GET atendimentos/medico <700ms': (r) => r.timings.duration < 700,
  });
  registra('op4', r4);
  sleep(1);

  // REQ 5: "triagens do paciente" — equivale ao GET /atendimentos/paciente/:id do MS.
  // No monolito a operação existe como GET /pacientes/:id/historico-completo (visão 360°, join poliglota).
  const r5 = http.get(`${BASE_URL}/pacientes/${pacienteId}/historico-completo`, { tags: { name: 'GET /pacientes/:id/historico-completo' } });
  check(r5, {
    '[monolito] GET atendimentos/paciente 200':    (r) => r.status === 200,
    '[monolito] GET atendimentos/paciente <700ms': (r) => r.timings.duration < 700,
  });
  registra('op5', r5);
  sleep(1);

  // REQ 6: POST /medicos — linha de base de escrita simples
  const r6 = postJson(`${BASE_URL}/medicos`, {
    nomeCompleto: 'Dr. K6 Baseline',
    crm: `K6V${__VU}I${__ITER}T${Date.now()}/SP`,
    especialidade: 'Clinica Geral',
    ativo: true,
  }, { tags: { name: 'POST /medicos' } });
  check(r6, {
    '[monolito] POST medico 201':    (r) => r.status === 201,
    '[monolito] POST medico <500ms': (r) => r.timings.duration < 500,
  });
  registra('op6', r6);
  sleep(1);
}

// --- Exportacao CSV (1 arquivo por execucao em k6-scripts/results/) ----------
function n(x) {
  return x === undefined || x === null ? '' : Number(x).toFixed(2);
}

export function handleSummary(data) {
  const sys = (options.tags && options.tags.system_type) || 'monolito';
  const scen = (options.tags && options.tags.test_scenario) || SCENARIO;
  const durSec = (data.state.testRunDurationMs || 0) / 1000;
  const vusMax = data.metrics.vus_max ? data.metrics.vus_max.values.max : '';
  const ts = new Date().toISOString().replace(/[:.]/g, '-');

  const header = [
    'timestamp', 'system_type', 'scenario', 'vus_max', 'join', 'endpoint',
    'samples', 'avg_ms', 'min_ms', 'med_ms', 'p90_ms', 'p95_ms', 'p99_ms', 'max_ms',
    'rps', 'error_rate_pct', 'slo_pass_pct',
  ];
  const lines = [header.join(',')];

  for (const o of OPS) {
    const d = data.metrics[`${o.key}_dur`];
    if (!d) continue;
    const v = d.values;
    const e = data.metrics[`${o.key}_err`];
    const s = data.metrics[`${o.key}_slo`];
    const cnt = data.metrics[`${o.key}_n`];
    const samples = cnt ? cnt.values.count : 0;
    lines.push([
      ts, sys, scen, vusMax, o.label, o.endpoint,
      samples, n(v.avg), n(v.min), n(v.med), n(v['p(90)']), n(v['p(95)']), n(v['p(99)']), n(v.max),
      durSec ? (samples / durSec).toFixed(2) : '',
      e ? (e.values.rate * 100).toFixed(2) : '',
      s ? (s.values.rate * 100).toFixed(2) : '',
    ].join(','));
  }

  // Linha GLOBAL — agregado de todas as requisicoes do teste
  const dur = data.metrics.http_req_duration;
  const reqs = data.metrics.http_reqs;
  const failed = data.metrics.http_req_failed;
  const checks = data.metrics.checks;
  if (dur) {
    const v = dur.values;
    lines.push([
      ts, sys, scen, vusMax, 'GLOBAL', 'todas as requisicoes',
      reqs ? reqs.values.count : '', n(v.avg), n(v.min), n(v.med), n(v['p(90)']), n(v['p(95)']), n(v['p(99)']), n(v.max),
      reqs ? n(reqs.values.rate) : '',
      failed ? (failed.values.rate * 100).toFixed(2) : '',
      checks ? (checks.values.rate * 100).toFixed(2) : '',
    ].join(','));
  }

  const csv = lines.join('\n') + '\n';
  const file = `/scripts/results/${scen}/${sys}_${scen}_${ts}.csv`;
  const stdout =
    `\n[CSV] salvo em k6-scripts/results/${scen}/${sys}_${scen}_${ts}.csv\n` +
    lines.map((l) => '  ' + l).join('\n') + '\n';

  return { [file]: csv, stdout };
}
