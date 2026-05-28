import http from 'k6/http';
import { check, sleep } from 'k6';

const MONO = __ENV.MONO_URL || 'http://api_pep:3000';
const MS_MEDICOS      = 'http://ms_medicos:3001';
const MS_PACIENTES    = 'http://ms_pacientes:3002';
const MS_ATENDIMENTOS = 'http://ms_atendimentos:3003';
const MS_AUDITORIA    = 'http://ms_auditoria:3004';

const SCENARIO = __ENV.SCENARIO || '1';
const perfis = {
  '1': { stages: [{ duration: '30s', target: 20 }, { duration: '2m', target: 50 }, { duration: '30s', target: 0 }] },
  '2': { stages: [{ duration: '30s', target: 50 }, { duration: '3m', target: 200 }, { duration: '1m', target: 0 }] },
  '3': { stages: [{ duration: '30s', target: 100 }, { duration: '4m', target: 450 }, { duration: '1m', target: 0 }] },
};

export const options = {
  stages: perfis[SCENARIO].stages,
  thresholds: {
    'http_req_duration{arquitetura:monolito}': ['p(95)<2000'],
    'http_req_duration{arquitetura:ms}':       ['p(95)<2000'],
    'http_req_failed{arquitetura:monolito}':   ['rate<0.05'],
    'http_req_failed{arquitetura:ms}':         ['rate<0.05'],
  },
  tags: { test_scenario: 'mono-ms' },
};

function monoTag(name) { return { tags: { arquitetura: 'monolito', name, test_scenario: 'mono-ms' } }; }
function msTag(name)   { return { tags: { arquitetura: 'ms',       name, test_scenario: 'mono-ms' } }; }

const MEDICO_ID      = __ENV.MEDICO_ID      || '1';
const PACIENTE_ID    = __ENV.PACIENTE_ID    || '1';
const jsonHeaders    = { 'Content-Type': 'application/json' };

export default function () {
  { const r = http.get(`${MONO}/medicos/${MEDICO_ID}`, monoTag('GET /medicos')); check(r, { '[mono] medicos 200': (r) => r.status === 200 }); }
  { const r = http.get(`${MS_MEDICOS}/medicos/${MEDICO_ID}`, msTag('GET /medicos')); check(r, { '[ms] medicos 200': (r) => r.status === 200 }); }
  sleep(0.2);

  const pacienteBody = JSON.stringify({ nome: `Paciente K6 ${Date.now()}`, cpf: `${Math.floor(Math.random() * 90000000000) + 10000000000}`, dataNascimento: '1990-01-01' });
  { const r = http.post(`${MONO}/pacientes`, pacienteBody, { headers: jsonHeaders, ...monoTag('POST /pacientes') }); check(r, { '[mono] paciente criado': (r) => r.status === 201 }); }
  { const r = http.post(`${MS_PACIENTES}/pacientes`, pacienteBody, { headers: jsonHeaders, ...msTag('POST /pacientes') }); check(r, { '[ms] paciente criado': (r) => r.status === 201 }); }
  sleep(0.2);

  const atendimentoBody = JSON.stringify({ pacienteId: PACIENTE_ID, medicoId: MEDICO_ID, descricao: 'Atendimento k6 benchmark', prioridade: 'MEDIA' });
  { const r = http.post(`${MONO}/atendimentos`, atendimentoBody, { headers: jsonHeaders, ...monoTag('POST /atendimentos') }); check(r, { '[mono] atendimento criado': (r) => r.status === 201 }); }
  { const r = http.post(`${MS_ATENDIMENTOS}/atendimentos`, atendimentoBody, { headers: jsonHeaders, ...msTag('POST /atendimentos') }); check(r, { '[ms] atendimento criado': (r) => r.status === 201 }); }
  sleep(0.2);

  { const r = http.get(`${MONO}/atendimentos`, monoTag('GET /atendimentos')); check(r, { '[mono] atendimentos 200': (r) => r.status === 200 }); }
  { const r = http.get(`${MS_ATENDIMENTOS}/atendimentos`, msTag('GET /atendimentos')); check(r, { '[ms] atendimentos 200': (r) => r.status === 200 }); }
  sleep(0.2);

  { const r = http.get(`${MONO}/logs-auditoria`, monoTag('GET /logs-auditoria')); check(r, { '[mono] auditoria 200': (r) => r.status === 200 }); }
  { const r = http.get(`${MS_AUDITORIA}/auditoria`, msTag('GET /logs-auditoria')); check(r, { '[ms] auditoria 200': (r) => r.status === 200 }); }
  sleep(0.3);
}
