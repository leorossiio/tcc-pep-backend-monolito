-- Extensão para UUID (gera UUID v4 se necessário)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Remover tipo se existir (para idempotência, mas cuidado com dependências)
DROP TYPE IF EXISTS RiscoManchester CASCADE;

-- Enum de classificação de risco Manchester
CREATE TYPE RiscoManchester AS ENUM ('VERMELHO', 'LARANJA', 'AMARELO', 'VERDE', 'AZUL');

-- Tabela PACIENTES_PG
CREATE TABLE IF NOT EXISTS PACIENTES_PG (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_completo VARCHAR NOT NULL,  -- Criptografado AES-256-GCM na aplicação
    sexo VARCHAR NOT NULL CHECK (sexo IN ('M', 'F', 'Outro')), -- Ajustado para M/F/Outro conforme DBML
    cpf_hash VARCHAR UNIQUE NOT NULL,  -- HMAC-SHA256 do CPF
    data_nascimento DATE NOT NULL,
    telefone_contato VARCHAR,
    tipagem_sanguinea VARCHAR,
    consentimento_lgpd BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabela MEDICOS_PG
CREATE TABLE IF NOT EXISTS MEDICOS_PG (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_completo VARCHAR NOT NULL,
    crm VARCHAR UNIQUE NOT NULL,
    especialidade VARCHAR NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabela ATENDIMENTOS_PG
CREATE TABLE IF NOT EXISTS ATENDIMENTOS_PG (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES PACIENTES_PG(id) ON DELETE RESTRICT,
    medico_triagem_id UUID NOT NULL REFERENCES MEDICOS_PG(id),
    data_hora_entrada TIMESTAMP NOT NULL DEFAULT NOW(),
    queixa_principal VARCHAR NOT NULL,
    pressao_arterial VARCHAR,
    frequencia_cardiaca INT CHECK (frequencia_cardiaca > 0),
    saturacao_oxigenio INT CHECK (saturacao_oxigenio BETWEEN 0 AND 100),
    temperatura_corporal DECIMAL(4,1) CHECK (temperatura_corporal BETWEEN 30 AND 45),
    frequencia_respiratoria INT CHECK (frequencia_respiratoria > 0),
    classificacao_risco RiscoManchester NOT NULL
);

-- Tabela LOGS_AUDITORIA_PG
CREATE TABLE IF NOT EXISTS LOGS_AUDITORIA_PG (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    atendimento_id UUID REFERENCES ATENDIMENTOS_PG(id) ON DELETE SET NULL, -- Passou a ser NULLable
    acao_realizada VARCHAR NOT NULL,
    data_hora TIMESTAMP NOT NULL DEFAULT NOW(),
    ip_origem VARCHAR,
    entidade_afetada VARCHAR NOT NULL,  -- Nova coluna
    entidade_id VARCHAR,                -- Nova coluna (UUID ou ObjectId)
    usuario_responsavel VARCHAR         -- Nova coluna (medicoId, userId ou sistema)
);

-- Índices para desempenho
CREATE INDEX IF NOT EXISTS idx_pacientes_cpf_hash ON PACIENTES_PG(cpf_hash);
CREATE INDEX IF NOT EXISTS idx_pacientes_criado_em ON PACIENTES_PG(criado_em);

CREATE INDEX IF NOT EXISTS idx_medicos_crm ON MEDICOS_PG(crm);
CREATE INDEX IF NOT EXISTS idx_medicos_especialidade ON MEDICOS_PG(especialidade);

CREATE INDEX IF NOT EXISTS idx_atendimentos_paciente ON ATENDIMENTOS_PG(paciente_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_medico ON ATENDIMENTOS_PG(medico_triagem_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_data_entrada ON ATENDIMENTOS_PG(data_hora_entrada);
CREATE INDEX IF NOT EXISTS idx_atendimentos_classificacao ON ATENDIMENTOS_PG(classificacao_risco);

CREATE INDEX IF NOT EXISTS idx_logs_atendimento ON LOGS_AUDITORIA_PG(atendimento_id);
CREATE INDEX IF NOT EXISTS idx_logs_data_hora ON LOGS_AUDITORIA_PG(data_hora);

-- Comentários documentais (segurança/LGPD)
COMMENT ON COLUMN PACIENTES_PG.nome_completo IS 'Criptografado AES-256-GCM na aplicação';
COMMENT ON COLUMN PACIENTES_PG.cpf_hash IS 'HMAC-SHA256 do CPF – não armazena CPF em texto puro';
COMMENT ON COLUMN PACIENTES_PG.consentimento_lgpd IS 'Registro de consentimento para tratamento de dados LGPD';
COMMENT ON COLUMN LOGS_AUDITORIA_PG.entidade_afetada IS 'Ex: Atendimento | ConsultaLaudo | Paciente';
COMMENT ON COLUMN LOGS_AUDITORIA_PG.entidade_id IS 'UUID ou ObjectId do registro afetado';
COMMENT ON COLUMN LOGS_AUDITORIA_PG.usuario_responsavel IS 'medicoId, userId ou sistema';