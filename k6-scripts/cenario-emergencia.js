import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const BASE_URL = 'http://app-monolito:3000';
const HEADERS = { 'Content-Type': 'application/json' };

// --- Perfis de carga (3 minutos cada) ----------------------------------------
const SCENARIOS = {
  '1': {
    stages: [
      { duration: '30s', target: 30 },  // Sobe para 30
      { duration: '2m', target: 30},  // Mantém
      { duration: '30s', target: 0 },  // Desce
    ],
    thresholds: {
      http_req_duration: ['p(95)<800'],
      http_req_failed: ['rate<0.01'],
    },
  },
  '2': {
    stages: [
      { duration: '30s', target: 100 }, // Sobe para 100
      { duration: '2m', target: 100 }, // Mantém
      { duration: '30s', target: 0 }, // Desce
    ],
    thresholds: {
      http_req_duration: ['p(95)<1200'],
      http_req_failed: ['rate<0.05'],
    },
  },
  '3': {
    stages: [
      { duration: '45s', target: 250 }, // Sobe para 250 (um pouco mais de tempo para não gargalar a subida)
      { duration: '1m30s', target: 250 }, // Mantém
      { duration: '45s', target: 0 }, // Desce
    ],
    thresholds: {
      http_req_duration: ['p(95)<3000'],
      http_req_failed: ['rate<0.15'],
    },
  },
};

const scenarioKey = __ENV.SCENARIO || '1';
const selectedScenario = SCENARIOS[scenarioKey];

if (!selectedScenario) {
  fail(`Cenario invalido: SCENARIO=${scenarioKey}. Use 1 (Normal), 2 (Dia Corrido) ou 3 (Emergencia).`);
}

export const options = {
  stages: selectedScenario.stages,
  thresholds: selectedScenario.thresholds,
  tags: {
    test_scenario: scenarioKey === '1' ? 'normal' : scenarioKey === '2' ? 'dia-corrido' : 'emergencia',
    system_type: 'monolito',
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

// --- Metricas por Join (exportadas em CSV pelo handleSummary) -----------------
// Para cada Join registramos: duracao (Trend, em ms), taxa de erro (Rate) e
// taxa de cumprimento do SLO de latencia (Rate). Tudo vira coluna no CSV.
const JOINS = [
  { key: 'join1', label: 'Join 1', endpoint: 'POST /atendimentos',                    expect: 201, slo: 800 },
  { key: 'join2', label: 'Join 2', endpoint: 'GET /atendimentos/:id',                 expect: 200, slo: 500 },
  { key: 'join3', label: 'Join 3', endpoint: 'GET /pacientes/:id/historico-completo', expect: 200, slo: 600 },
  { key: 'join4', label: 'Join 4', endpoint: 'POST /consultas-laudos',                expect: 201, slo: 800 },
  { key: 'join5', label: 'Join 5', endpoint: 'GET /medicos/:id/laudos',               expect: 200, slo: 700 },
];
const JOIN_BY_KEY = {};
const METRICS = {};
for (const j of JOINS) {
  JOIN_BY_KEY[j.key] = j;
  METRICS[j.key] = {
    n: new Counter(`${j.key}_n`),
    dur: new Trend(`${j.key}_dur`, true),
    err: new Rate(`${j.key}_err`),
    slo: new Rate(`${j.key}_slo`),
  };
}
function registra(key, res) {
  const j = JOIN_BY_KEY[key];
  const m = METRICS[key];
  m.n.add(1);
  m.dur.add(res.timings.duration);
  m.err.add(res.status !== j.expect);
  m.slo.add(res.timings.duration < j.slo);
}

// --- Helpers -----------------------------------------------------------------
function postJson(url, body) {
  return http.post(url, JSON.stringify(body), { headers: HEADERS });
}

function assertCreated(res, label) {
  if (res.status !== 201) {
    console.error(`[setup] FALHA em ${label}: status=${res.status} body=${res.body}`);
    fail(`setup falhou em: ${label}`);
  }
  return res.json();
}

function assertOk(res, label) {
  if (res.status !== 200) {
    console.error(`[setup] FALHA em ${label}: status=${res.status} body=${res.body}`);
    fail(`setup falhou em: ${label}`);
  }
  return res.json();
}

// --- setup() -----------------------------------------------------------------
// Cria um POOL de medicos e pacientes em vez de um unico registro compartilhado.
// Cada VU usa um paciente distinto do pool (rotacao por __VU), evitando que o
// dataset cresca de forma desbalanceada em um unico paciente durante o teste.
// Sem isso, a latencia dos reads (Join 3 e Join 5) subiria por acumulo de dados
// e não pelo custo real da persistencia poliglota — invalidando a comparacao.
const POOL_MEDICOS = Number(__ENV.POOL_MEDICOS || 8);
const POOL_PACIENTES = Number(__ENV.POOL_PACIENTES || 40);

export function setup() {
  const base = Date.now();

  // 1. Pool de medicos
  const medicoIds = [];
  for (let i = 0; i < POOL_MEDICOS; i++) {
    const medico = assertCreated(
      postJson(`${BASE_URL}/medicos`, {
        nomeCompleto: `Dr. K6 Benchmark ${i}`,
        crm: `K6${base}_${i}/SP`,
        especialidade: 'Clinica Geral',
        ativo: true,
      }),
      `POST /medicos #${i}`,
    );
    medicoIds.push(medico.id);
  }

  // 2. Pool de pacientes. Para cada um, o POST /atendimentos ja dispara o
  //    dual-write (atendimento + historico + triagem), entao basta buscar o
  //    historicoId em seguida para alimentar os reads do default().
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

    const historico = assertOk(
      http.get(`${BASE_URL}/historico-clinicos/paciente/${paciente.id}`),
      `GET /historico-clinicos/paciente/:id #${i}`,
    );

    registros.push({
      pacienteId: paciente.id,
      medicoId,
      atendimentoId: atendimento.atendimentoId,
      historicoId: historico._id,
    });
  }

  console.log(`[setup] OK — ${medicoIds.length} medicos e ${registros.length} pacientes criados (cada VU usa 1 paciente do pool)`);
  return { registros };
}

// --- default() ---------------------------------------------------------------
export default function (data) {
  const pool = data.registros;
  // Cada VU fica fixo num paciente do pool; iteracoes do mesmo VU reutilizam-no.
  const { medicoId, pacienteId, atendimentoId, historicoId } =
    pool[(__VU - 1) % pool.length];

  const resAtendimento = http.get(`${BASE_URL}/atendimentos/${atendimentoId}`);
  check(resAtendimento, {
    '[Join 2] prontuario 200': (r) => r.status === 200,
    '[Join 2] latencia < 500ms': (r) => r.timings.duration < 500,
  });
  registra('join2', resAtendimento);

  sleep(1);

  const resHistorico = http.get(`${BASE_URL}/pacientes/${pacienteId}/historico-completo`);
  check(resHistorico, {
    '[Join 3] historico-completo 200': (r) => r.status === 200,
    '[Join 3] latencia < 600ms': (r) => r.timings.duration < 600,
  });
  registra('join3', resHistorico);

  sleep(1);

  const resAtend = postJson(`${BASE_URL}/atendimentos`, {
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
  });
  check(resAtend, {
    '[Join 1] dual-write 201': (r) => r.status === 201,
    '[Join 1] latencia < 800ms': (r) => r.timings.duration < 800,
  });
  registra('join1', resAtend);

  const novoAtendimentoId = resAtend.status === 201 ? resAtend.json().atendimentoId : atendimentoId;

  sleep(1);

  const resLaudo = postJson(`${BASE_URL}/consultas-laudos`, {
    atendimentoId: novoAtendimentoId,
    historicoId,
    pacienteId,
    medicoId,
    dataRegistro: new Date().toISOString(),
    tipoRegistro: 'CONSULTA',
    descricaoClinica: `VU ${__VU} iter ${__ITER} — avaliacao clinica de emergencia. Paciente com dor toracica.`,
    prescricoes: [
      { medicamento: 'Acido Acetilsalicilico', dose: '300mg', frequencia: 'Dose unica', duracao: 'Imediato' },
      { medicamento: 'Morfina', dose: '2mg IV', frequencia: 'Se necessario' },
    ],
  });
  check(resLaudo, {
    '[Join 4] laudo 201': (r) => r.status === 201,
    '[Join 4] latencia < 800ms': (r) => r.timings.duration < 800,
  });
  registra('join4', resLaudo);

  sleep(1);

  const resLaudosMedico = http.get(`${BASE_URL}/medicos/${medicoId}/laudos`);
  check(resLaudosMedico, {
    '[Join 5] laudos-medico 200': (r) => r.status === 200,
    '[Join 5] latencia < 700ms': (r) => r.timings.duration < 700,
  });
  registra('join5', resLaudosMedico);

  sleep(1);
}

// --- Exportacao CSV (1 arquivo por execucao em k6-scripts/results/) ----------
function n(x) {
  return x === undefined || x === null ? '' : Number(x).toFixed(2);
}

export function handleSummary(data) {
  const sys = (options.tags && options.tags.system_type) || 'monolito';
  const scen = (options.tags && options.tags.test_scenario) || scenarioKey;
  const durSec = (data.state.testRunDurationMs || 0) / 1000;
  const vusMax = data.metrics.vus_max ? data.metrics.vus_max.values.max : '';
  const ts = new Date().toISOString().replace(/[:.]/g, '-');

  const header = [
    'timestamp', 'system_type', 'scenario', 'vus_max', 'join', 'endpoint',
    'samples', 'avg_ms', 'min_ms', 'med_ms', 'p90_ms', 'p95_ms', 'p99_ms', 'max_ms',
    'rps', 'error_rate_pct', 'slo_pass_pct',
  ];
  const lines = [header.join(',')];

  for (const j of JOINS) {
    const d = data.metrics[`${j.key}_dur`];
    if (!d) continue;
    const v = d.values;
    const e = data.metrics[`${j.key}_err`];
    const s = data.metrics[`${j.key}_slo`];
    const cnt = data.metrics[`${j.key}_n`];
    const samples = cnt ? cnt.values.count : 0;
    lines.push([
      ts, sys, scen, vusMax, j.label, j.endpoint,
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