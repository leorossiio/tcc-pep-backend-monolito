import http from 'k6/http';
import { check, sleep, fail } from 'k6';

// --- URL base da API ----------------------------------------------------------
const BASE_URL = 'http://app-monolito:3000';
const HEADERS  = { 'Content-Type': 'application/json' };

// --- Op��es do teste ----------------------------------------------------------
export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m',  target: 50 },
    { duration: '30s', target: 0  },
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed:   ['rate<0.01'],
  },
};

// --- Helpers ------------------------------------------------------------------
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

// --- setup() -----------------------------------------------------------------
export function setup() {
  const ts = Date.now();

  // 1. M�dico
  const medico = assertCreated(
    postJson(`${BASE_URL}/medicos`, {
      nomeCompleto: 'Dr. K6 Benchmark',
      crm: `K6${ts}/SP`,
      especialidade: 'Clinica Geral',
      ativo: true,
    }),
    'POST /medicos',
  );

  // 2. Paciente � CPF com exatamente 11 digitos numericos
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

  // 3. Historico clinico (MongoDB) � obrigatorio antes de criar atendimento
  assertCreated(
    postJson(`${BASE_URL}/historico-clinicos`, {
      pacienteId: paciente.id,
      alergiasConhecidas: [],
      comorbidadesPrevias: [],
      metadadosLgpd: {
        consentimentoColetado: true,
        dataConsentimento: new Date().toISOString(),
        finalidadeTratamento: 'assistencia a saude',
        responsavelTratamento: 'Sistema K6 Benchmark',
        anonimizado: false,
      },
    }),
    'POST /historico-clinicos',
  );

  // 4. Atendimento inicial para leituras de prontuario
  const atendimento = assertCreated(
    postJson(`${BASE_URL}/atendimentos`, {
      pacienteId:             paciente.id,
      medicoTriagemId:        medico.id,
      dataHoraEntrada:        new Date().toISOString(),
      queixaPrincipal:        'Setup k6 - dor abdominal',
      pressaoArterial:        '120/80',
      frequenciaCardiaca:     80,
      saturacaoOxigenio:      98,
      temperaturaCorporal:    36.8,
      frequenciaRespiratoria: 16,
      classificacaoRisco:     'AMARELO',
    }),
    'POST /atendimentos',
  );

  console.log(`[setup] OK � medicoId=${medico.id} pacienteId=${paciente.id} atendimentoId=${atendimento.atendimentoId}`);
  return { medicoId: medico.id, pacienteId: paciente.id, atendimentoId: atendimento.atendimentoId };
}

// --- default() ---------------------------------------------------------------
export default function (data) {
  const { medicoId, pacienteId, atendimentoId } = data;

  // Join 2 � leitura de prontuario completo (PG -> Mongo)
  const resLeitura = http.get(`${BASE_URL}/atendimentos/${atendimentoId}`);
  check(resLeitura, {
    '[Join 2] prontuario 200':    (r) => r.status === 200,
    '[Join 2] latencia < 500ms':  (r) => r.timings.duration < 500,
  });

  sleep(2);

  // Join 1 � dual-write (PG + Mongo)
  const resEscrita = postJson(`${BASE_URL}/atendimentos`, {
    pacienteId,
    medicoTriagemId:        medicoId,
    dataHoraEntrada:        new Date().toISOString(),
    queixaPrincipal:        `VU ${__VU} iter ${__ITER}`,
    pressaoArterial:        '130/85',
    frequenciaCardiaca:     90,
    saturacaoOxigenio:      97,
    temperaturaCorporal:    37.2,
    frequenciaRespiratoria: 18,
    classificacaoRisco:     'VERDE',
  });
  check(resEscrita, {
    '[Join 1] dual-write 201':    (r) => r.status === 201,
    '[Join 1] latencia < 800ms':  (r) => r.timings.duration < 800,
  });

  sleep(1);
}
