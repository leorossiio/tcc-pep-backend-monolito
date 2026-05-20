import http from 'k6/http';
import { check, sleep, fail } from 'k6';

// --- URL base da API ----------------------------------------------------------
const BASE_URL = 'http://app-monolito:3000';
const HEADERS  = { 'Content-Type': 'application/json' };

// --- Opcoes do teste ----------------------------------------------------------
export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m',  target: 10 },
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

  // 1. Medico
  const medico = assertCreated(
    postJson(`${BASE_URL}/medicos`, {
      nomeCompleto: 'Dr. K6 Benchmark',
      crm: `K6${ts}/SP`,
      especialidade: 'Clinica Geral',
      ativo: true,
    }),
    'POST /medicos',
  );

  // 2. Paciente — CPF com exatamente 11 digitos numericos
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

  // 3. Atendimento inicial — dual-write (PG + MDB).
  //    O historico clinico no MongoDB e criado automaticamente pelo
  //    AtendimentosService na primeira triagem do paciente.
  const atendimento = assertCreated(
    postJson(`${BASE_URL}/atendimentos`, {
      pacienteId:             paciente.id,
      medicoTriagemId:        medico.id,
      dataHoraEntrada:        new Date().toISOString(),
      queixaPrincipal:        'Setup k6 - dor abdominal aguda',
      pressaoArterial:        '120/80',
      frequenciaCardiaca:     80,
      saturacaoOxigenio:      98,
      temperaturaCorporal:    36.8,
      frequenciaRespiratoria: 16,
      classificacaoRisco:     'AMARELO',
    }),
    'POST /atendimentos',
  );

  // 4. Busca o historico clinico criado automaticamente (MongoDB) para obter o _id
  const historico = assertOk(
    http.get(`${BASE_URL}/historico-clinicos/paciente/${paciente.id}`),
    'GET /historico-clinicos/paciente/:pacienteId',
  );

  // 5. Consulta/Laudo inicial de triagem (MongoDB)
  assertCreated(
    postJson(`${BASE_URL}/consultas-laudos`, {
      atendimentoId:    atendimento.atendimentoId,
      historicoId:      historico._id,
      pacienteId:       paciente.id,
      medicoId:         medico.id,
      dataRegistro:     new Date().toISOString(),
      tipoRegistro:     'TRIAGEM',
      descricaoClinica: 'Setup k6 — triagem inicial. Paciente estavel, aguardando avaliacao.',
    }),
    'POST /consultas-laudos',
  );

  console.log(`[setup] OK — medicoId=${medico.id} pacienteId=${paciente.id} atendimentoId=${atendimento.atendimentoId} historicoId=${historico._id}`);
  return {
    medicoId:      medico.id,
    pacienteId:    paciente.id,
    atendimentoId: atendimento.atendimentoId,
    historicoId:   historico._id,
  };
}

// --- default() ---------------------------------------------------------------
export default function (data) {
  const { medicoId, pacienteId, atendimentoId, historicoId } = data;

  // Join 2 — leitura de prontuario completo (PG -> MongoDB)
  const resAtendimento = http.get(`${BASE_URL}/atendimentos/${atendimentoId}`);
  check(resAtendimento, {
    '[Join 2] prontuario 200':   (r) => r.status === 200,
    '[Join 2] latencia < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);

  // Join 3 — visao 360 do paciente (PG + MongoDB)
  const resHistorico = http.get(`${BASE_URL}/pacientes/${pacienteId}/historico-completo`);
  check(resHistorico, {
    '[Join 3] historico-completo 200': (r) => r.status === 200,
    '[Join 3] latencia < 600ms':       (r) => r.timings.duration < 600,
  });

  sleep(1);

  // Join 1 — dual-write: nova triagem de emergencia (PG + MongoDB)
  const resAtend = postJson(`${BASE_URL}/atendimentos`, {
    pacienteId,
    medicoTriagemId:        medicoId,
    dataHoraEntrada:        new Date().toISOString(),
    queixaPrincipal:        `VU ${__VU} iter ${__ITER} — dor toracica intensa`,
    pressaoArterial:        '150/95',
    frequenciaCardiaca:     110,
    saturacaoOxigenio:      94,
    temperaturaCorporal:    38.1,
    frequenciaRespiratoria: 22,
    classificacaoRisco:     'VERMELHO',
  });
  check(resAtend, {
    '[Join 1] dual-write 201':   (r) => r.status === 201,
    '[Join 1] latencia < 800ms': (r) => r.timings.duration < 800,
  });

  const novoAtendimentoId = resAtend.status === 201 ? resAtend.json().atendimentoId : atendimentoId;

  sleep(1);

  // Join 4 — registro de laudo/consulta medica (MongoDB + propaga alergias ao historico)
  const resLaudo = postJson(`${BASE_URL}/consultas-laudos`, {
    atendimentoId:    novoAtendimentoId,
    historicoId,
    pacienteId,
    medicoId,
    dataRegistro:     new Date().toISOString(),
    tipoRegistro:     'CONSULTA',
    descricaoClinica: `VU ${__VU} iter ${__ITER} — avaliacao clinica de emergencia. Paciente com dor toracica.`,
    prescricoes: [
      { medicamento: 'Acido Acetilsalicilico', dose: '300mg', frequencia: 'Dose unica', duracao: 'Imediato' },
      { medicamento: 'Morfina',                dose: '2mg IV', frequencia: 'Se necessario' },
    ],
  });
  check(resLaudo, {
    '[Join 4] laudo 201':        (r) => r.status === 201,
    '[Join 4] latencia < 800ms': (r) => r.timings.duration < 800,
  });

  sleep(1);

  // Join 5 — laudos assinados pelo medico com atendimentos relacionados (MongoDB -> PG)
  const resLaudosMedico = http.get(`${BASE_URL}/medicos/${medicoId}/laudos`);
  check(resLaudosMedico, {
    '[Join 5] laudos-medico 200': (r) => r.status === 200,
    '[Join 5] latencia < 700ms':  (r) => r.timings.duration < 700,
  });

  sleep(1);
}