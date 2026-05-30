import http from 'k6/http';
import { check, sleep, fail } from 'k6';

const BASE_URL = 'http://app-monolito:3000';
const HEADERS = { 'Content-Type': 'application/json' };

// --- Perfis de carga (3 minutos cada) ----------------------------------------
const SCENARIOS = {
  '1': {
    stages: [
      { duration: '30s', target: 30 },  // Sobe para 50
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
  },
};

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
export function setup() {
  const ts = Date.now();

  const medico = assertCreated(
    postJson(`${BASE_URL}/medicos`, {
      nomeCompleto: 'Dr. K6 Benchmark',
      crm: `K6${ts}/SP`,
      especialidade: 'Clinica Geral',
      ativo: true,
    }),
    'POST /medicos',
  );

  const cpf = String(ts).slice(-11).padStart(11, '1');
  const paciente = assertCreated(
    postJson(`${BASE_URL}/pacientes`, {
      nomeCompleto: 'Paciente Benchmark K6',
      sexo: 'M',
      cpf,
      dataNascimento: '1990-01-15',
      consentimentoLgpd: true,
    }),
    'POST /pacientes',
  );

  const atendimento = assertCreated(
    postJson(`${BASE_URL}/atendimentos`, {
      pacienteId: paciente.id,
      medicoTriagemId: medico.id,
      dataHoraEntrada: new Date().toISOString(),
      queixaPrincipal: 'Setup k6 - dor abdominal aguda',
      pressaoArterial: '120/80',
      frequenciaCardiaca: 80,
      saturacaoOxigenio: 98,
      temperaturaCorporal: 36.8,
      frequenciaRespiratoria: 16,
      classificacaoRisco: 'AMARELO',
    }),
    'POST /atendimentos',
  );

  const historico = assertOk(
    http.get(`${BASE_URL}/historico-clinicos/paciente/${paciente.id}`),
    'GET /historico-clinicos/paciente/:pacienteId',
  );

  assertCreated(
    postJson(`${BASE_URL}/consultas-laudos`, {
      atendimentoId: atendimento.atendimentoId,
      historicoId: historico._id,
      pacienteId: paciente.id,
      medicoId: medico.id,
      dataRegistro: new Date().toISOString(),
      tipoRegistro: 'TRIAGEM',
      descricaoClinica: 'Setup k6 — triagem inicial. Paciente estavel, aguardando avaliacao.',
    }),
    'POST /consultas-laudos',
  );

  console.log(`[setup] OK — medicoId=${medico.id} pacienteId=${paciente.id} atendimentoId=${atendimento.atendimentoId} historicoId=${historico._id}`);
  return {
    medicoId: medico.id,
    pacienteId: paciente.id,
    atendimentoId: atendimento.atendimentoId,
    historicoId: historico._id,
  };
}

// --- default() ---------------------------------------------------------------
export default function (data) {
  const { medicoId, pacienteId, atendimentoId, historicoId } = data;

  const resAtendimento = http.get(`${BASE_URL}/atendimentos/${atendimentoId}`);
  check(resAtendimento, {
    '[Join 2] prontuario 200': (r) => r.status === 200,
    '[Join 2] latencia < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);

  const resHistorico = http.get(`${BASE_URL}/pacientes/${pacienteId}/historico-completo`);
  check(resHistorico, {
    '[Join 3] historico-completo 200': (r) => r.status === 200,
    '[Join 3] latencia < 600ms': (r) => r.timings.duration < 600,
  });

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

  sleep(1);

  const resLaudosMedico = http.get(`${BASE_URL}/medicos/${medicoId}/laudos`);
  check(resLaudosMedico, {
    '[Join 5] laudos-medico 200': (r) => r.status === 200,
    '[Join 5] latencia < 700ms': (r) => r.timings.duration < 700,
  });

  sleep(1);
}