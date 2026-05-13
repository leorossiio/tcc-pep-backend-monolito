// Conecta ao banco definido pela variável MONGO_INITDB_DATABASE (pep_nao_relacional)
const db = db.getSiblingDB('pep_nao_relacional');

// =====================
// Coleção: historico_clinicos
// =====================
db.createCollection('historico_clinicos', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['paciente_id', 'metadados_lgpd'],
      properties: {
        paciente_id: {
          bsonType: 'string',
          description: 'UUID do paciente (referência lógica ao PostgreSQL)'
        },
        alergias_conhecidas: {
          bsonType: 'array',
          items: { bsonType: 'string' }
        },
        comorbidades_previas: {
          bsonType: 'array',
          items: { bsonType: 'string' }
        },
        tipos_sanguineos_incompativeis: {
          bsonType: 'array',
          items: { bsonType: 'string' }
        },
        metadados_lgpd: {
          bsonType: 'object',
          required: ['consentimento_em', 'retencao_maxima', 'hash_integridade', 'ultima_revisao'],
          properties: {
            consentimento_em: { bsonType: 'date' },
            retencao_maxima: { bsonType: 'int' },
            hash_integridade: { bsonType: 'string' },
            ultima_revisao: { bsonType: 'date' }
          }
        }
      }
    }
  }
});

// Índices
db.historico_clinicos.createIndex({ paciente_id: 1 }, { unique: true });
db.historico_clinicos.createIndex({ "metadados_lgpd.ultima_revisao": -1 });

// =====================
// Coleção: consultas_laudos
// =====================
db.createCollection('consultas_laudos', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['atendimento_id', 'historico_id', 'medico_id', 'data_registro', 'tipo_registro', 'descricao_clinica'],
      properties: {
        atendimento_id: { bsonType: 'string' },
        historico_id: { bsonType: 'string' },
        medico_id: { bsonType: 'string' },
        data_registro: { bsonType: 'date' },
        tipo_registro: {
          bsonType: 'string',
          enum: ['CONSULTA', 'RETORNO', 'EMERGENCIA', 'PRESCRICAO']
        },
        descricao_clinica: { bsonType: 'string' },
        prescricoes: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            properties: {
              medicamento: { bsonType: 'string' },
              dose: { bsonType: 'string' },
              frequencia: { bsonType: 'string' },
              duracao: { bsonType: 'string' }
            }
          }
        },
        exames_anexos: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            properties: {
              tipo: { bsonType: 'string' },
              descricao: { bsonType: 'string' },
              data_solicitacao: { bsonType: 'date' },
              resultado: { bsonType: 'string' }
            }
          }
        },
        novas_alergias_identificadas: {
          bsonType: 'array',
          items: { bsonType: 'string' }
        }
      }
    }
  }
});

// Índices
db.consultas_laudos.createIndex({ atendimento_id: 1 }, { unique: true });
db.consultas_laudos.createIndex({ historico_id: 1 });
db.consultas_laudos.createIndex({ medico_id: 1 });
db.consultas_laudos.createIndex({ data_registro: -1 });

print('MongoDB initialization complete: pep_nao_relacional ready');