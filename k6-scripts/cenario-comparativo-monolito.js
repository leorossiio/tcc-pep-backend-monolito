import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://app-monolito:3000';
const HEADERS = { 'Content-Type': 'application/json' };

const SCENARIO = __ENV.SCENARIO || '1';
const REPETICAO = __ENV.REPETICAO; 
if (!REPETICAO) fail('REPETICAO nao informada. Rode com -e REPETICAO=<n>.');

const WARMUP_DURATION = __ENV.WARMUP_DURATION || '45s';

const SCENARIOS = {
  '1': { stages: [{ duration: '30s', target: 50 }, { duration: '2m', target: 50 }, { duration: '30s', target: 0 }], scenarioName: 'normal' },
  '2': { stages: [{ duration: '30s', target: 150 }, { duration: '2m', target: 150 }, { duration: '30s', target: 0 }], scenarioName: 'dia-corrido' },
  '3': { stages: [{ duration: '45s', target: 300 }, { duration: '1m30s', target: 300 }, { duration: '45s', target: 0 }], scenarioName: 'emergencia' },
};

const selected = SCENARIOS[SCENARIO];
if (!selected) fail(`Cenario invalido: SCENARIO=${SCENARIO}.`);

function parseDurationToMs(d) {
  const re = /(\d+)h|(\d+)m|(\d+)s/g; let ms = 0; let match;
  while ((match = re.exec(d)) !== null) {
    if (match[1]) ms += Number(match[1]) * 3600000;
    if (match[2]) ms += Number(match[2]) * 60000;
    if (match[3]) ms += Number(match[3]) * 1000;
  }
  return ms;
}

const MEASUREMENT_DURATION_MS = selected.stages.reduce((acc, s) => acc + parseDurationToMs(s.duration), 0);
const PEAK_VUS = Math.max(...selected.stages.map((s) => s.target));
const WARMUP_VUS = Number(__ENV.WARMUP_VUS || Math.max(5, Math.round(PEAK_VUS * 0.2)));

// SLOs Unificados e rigorosos
const SLO = { op1: 800, op2: 600, op3: 600, op4: 800, op5: 700 };

export const options = {
  scenarios: {
    warmup: { executor: 'constant-vus', vus: WARMUP_VUS, duration: WARMUP_DURATION, exec: 'warmupFn', tags: { phase: 'warmup' } },
    medicao: { executor: 'ramping-vus', startVUs: 0, stages: selected.stages, exec: 'default', startTime: WARMUP_DURATION, gracefulStop: '15s', tags: { phase: 'measurement' } },
  },
  thresholds: {
    'http_req_duration{phase:measurement}': ['p(95)<3000'],
    'http_req_failed{phase:measurement}': ['rate<0.2'],
  },
  tags: { test_scenario: selected.scenarioName, system_type: 'monolito', repeticao: String(REPETICAO) },
};

// 5 Operações que testam Postgres, Mongo e Joins
const OPS = [
  { key: 'op1', label: 'POST atendimento (Dual-Write PG/Mongo)', endpoint: 'POST /atendimentos', expect: 201, slo: SLO.op1 },
  { key: 'op2', label: 'GET atendimento (PG + Mongo)',           endpoint: 'GET /atendimentos/:id', expect: 200, slo: SLO.op2 },
  { key: 'op3', label: 'GET historico completo (Mongo)',         endpoint: 'GET /pacientes/:id/historico-completo', expect: 200, slo: SLO.op3 },
  { key: 'op4', label: 'POST consultas-laudos (Mongo)',          endpoint: 'POST /consultas-laudos', expect: 201, slo: SLO.op4 },
  { key: 'op5', label: 'GET laudos do medico (Join)',            endpoint: 'GET /medicos/:id/laudos', expect: 200, slo: SLO.op5 },
];

const OP_BY_KEY = {}; const METRICS = {};
for (const o of OPS) {
  OP_BY_KEY[o.key] = o;
  METRICS[o.key] = { n: new Counter(`${o.key}_n`), dur: new Trend(`${o.key}_dur`, true), err: new Rate(`${o.key}_err`), slo: new Rate(`${o.key}_slo`) };
}

function registra(key, res) {
  const o = OP_BY_KEY[key]; const m = METRICS[key];
  m.n.add(1); m.dur.add(res.timings.duration); m.err.add(res.status !== o.expect); m.slo.add(res.timings.duration < o.slo);
}

function postJson(url, body, params = {}) { return http.post(url, JSON.stringify(body), { headers: HEADERS, ...params }); }
function assertCreated(res, label) { if (res.status !== 201) fail(`Setup falhou: ${label}`); return res.json(); }
function assertOk(res, label) { if (res.status !== 200) fail(`Setup falhou: ${label}`); return res.json(); }

const POOL_MEDICOS = Number(__ENV.POOL_MEDICOS || 8);
const POOL_PACIENTES = Number(__ENV.POOL_PACIENTES || Math.max(40, Math.ceil(PEAK_VUS / 7.5)));

export function setup() {
  const base = Date.now();
  const medicoIds = [];
  
  for (let i = 0; i < POOL_MEDICOS; i++) {
    const m = assertCreated(postJson(`${BASE_URL}/medicos`, { nomeCompleto: `Dr. Bench ${i}`, crm: `CRM${base}${i}/SP`, especialidade: 'Geral', ativo: true }), `POST /medicos #${i}`);
    medicoIds.push(m.id);
  }

  const registros = [];
  for (let i = 0; i < POOL_PACIENTES; i++) {
    const medicoId = medicoIds[i % medicoIds.length];
    const paciente = assertCreated(postJson(`${BASE_URL}/pacientes`, { nomeCompleto: `Pac ${i}`, sexo: 'M', cpf: String(base + i).slice(-11).padStart(11, '0'), dataNascimento: '1990-01-01', consentimentoLgpd: true }), `POST /pacientes #${i}`);
    const atendimento = assertCreated(postJson(`${BASE_URL}/atendimentos`, { pacienteId: paciente.id, medicoTriagemId: medicoId, dataHoraEntrada: new Date().toISOString(), queixaPrincipal: 'Setup', classificacaoRisco: 'AMARELO' }), `POST /atendimentos #${i}`);
    const historico = assertOk(http.get(`${BASE_URL}/historico-clinicos/paciente/${paciente.id}`), `GET historico #${i}`);
    
    registros.push({ pacienteId: paciente.id, medicoId, atendimentoId: atendimento.atendimentoId, historicoId: historico._id });
  }
  return { registros };
}

function executaFluxo(data, gravaMetricas) {
  const { pacienteId, medicoId, atendimentoId, historicoId } = data.registros[(__VU - 1) % data.registros.length];

  const r1 = postJson(`${BASE_URL}/atendimentos`, { pacienteId, medicoTriagemId: medicoId, dataHoraEntrada: new Date().toISOString(), queixaPrincipal: `Carga VU${__VU}`, classificacaoRisco: 'VERMELHO' }, { tags: { name: 'POST /atendimentos' } });
  check(r1, { '[monolito] POST atendimento 201': (r) => r.status === 201 });
  if (gravaMetricas) registra('op1', r1);
  const novoAtendimentoId = r1.status === 201 ? r1.json().atendimentoId : atendimentoId;
  sleep(1);

  const r2 = http.get(`${BASE_URL}/atendimentos/${novoAtendimentoId}`, { tags: { name: 'GET /atendimentos/:id' } });
  check(r2, { '[monolito] GET atendimento 200': (r) => r.status === 200 });
  if (gravaMetricas) registra('op2', r2);
  sleep(1);

  const r3 = http.get(`${BASE_URL}/pacientes/${pacienteId}/historico-completo`, { tags: { name: 'GET /historico-completo' } });
  check(r3, { '[monolito] GET historico 200': (r) => r.status === 200 });
  if (gravaMetricas) registra('op3', r3);
  sleep(1);

  const r4 = postJson(`${BASE_URL}/consultas-laudos`, { atendimentoId: novoAtendimentoId, historicoId, pacienteId, medicoId, dataRegistro: new Date().toISOString(), tipoRegistro: 'CONSULTA', descricaoClinica: `VU ${__VU}` }, { tags: { name: 'POST /consultas-laudos' } });
  check(r4, { '[monolito] POST laudo 201': (r) => r.status === 201 });
  if (gravaMetricas) registra('op4', r4);
  sleep(1);

  const r5 = http.get(`${BASE_URL}/medicos/${medicoId}/laudos`, { tags: { name: 'GET /medicos/:id/laudos' } });
  check(r5, { '[monolito] GET laudos medico 200': (r) => r.status === 200 });
  if (gravaMetricas) registra('op5', r5);
  sleep(1);
}

export function warmupFn(data) { executaFluxo(data, false); }
export default function (data) { executaFluxo(data, true); }

function n(x) { return x === undefined || x === null ? '' : Number(x).toFixed(2); }

export function handleSummary(data) {
  const sys = 'monolito'; const scen = selected.scenarioName; const durSec = MEASUREMENT_DURATION_MS / 1000;
  const vusMax = data.metrics.vus_max ? data.metrics.vus_max.values.max : ''; const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const repStr = String(REPETICAO).padStart(3, '0');

  let csv = 'timestamp,arquitetura,cenario,repeticao,vus_max,duracao_s,operacao,endpoint,amostras,avg_ms,med_ms,p95_ms,p99_ms,max_ms,taxa_erro_pct,slo_pass_pct\n';

  for (const o of OPS) {
    const d = data.metrics[`${o.key}_dur`];
    if (!d) continue;
    const v = d.values; const e = data.metrics[`${o.key}_err`]; const s = data.metrics[`${o.key}_slo`];
    csv += `${ts},${sys},${scen},${REPETICAO},${vusMax},${durSec},${o.label},${o.endpoint},${d.values.count},${n(v.avg)},${n(v.med)},${n(v['p(95)'])} ,${n(v['p(99)'])},${n(v.max)},${e ? (e.values.rate * 100).toFixed(2) : ''},${s ? (s.values.rate * 100).toFixed(2) : ''}\n`;
  }
  const file = `/scripts/results/${scen}/monolito_${scen}_rep${repStr}_${ts}.csv`;
  return { [file]: csv, stdout: `\n[CSV] salvo em k6-scripts/results/${scen}/monolito_${scen}_rep${repStr}_${ts}.csv\n` };
}