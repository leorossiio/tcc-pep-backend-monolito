// Conecta ao banco definido pela variável MONGO_INITDB_DATABASE (pep_nao_relacional)
const db = db.getSiblingDB('pep_nao_relacional');

// =====================
// Coleção: historico_clinicos
// =====================
db.createCollection('historico_clinicos', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['paciente_id', 'metadados_lgpd', 'hash_integridade', 'criado_em', 'atualizado_em'],
      properties: {
        paciente_id: {
          bsonType: 'string',
          description: 'UUID do paciente (referência lógica ao PostgreSQL)'
        },
        alergias_conhecidas: {
          bsonType: ['array', 'null'],
          items: {
            bsonType: 'object',
            required: ['substancia', 'severidade'],
            properties: {
              substancia: { bsonType: 'string' },
              severidade: { bsonType: 'string', enum: ['leve', 'moderada', 'grave'] },
              reacao: { bsonType: 'string' }
            }
          }
        },
        comorbidades_previas: {
          bsonType: ['array', 'null'],
          items: {
            bsonType: 'object',
            required: ['descricao', 'ativa'],
            properties: {
              descricao: { bsonType: 'string' },
              cid10: { bsonType: 'string' },
              dataDiagnostico: { bsonType: 'date' },
              ativa: { bsonType: 'bool' }
            }
          }
        },
        tipos_sanguineos_incompativeis: {
          bsonType: ['array', 'null'],
          items: {
            bsonType: 'object',
            required: ['tipo'],
            properties: {
              tipo: { bsonType: 'string' },
              motivo: { bsonType: 'string' }
            }
          }
        },
        metadados_lgpd: {
          bsonType: 'object',
          required: ['consentimentoColetado', 'finalidadeTratamento', 'responsavelTratamento', 'anonimizado'],
          properties: {
            consentimentoColetado: { bsonType: 'bool' },
            dataConsentimento: { bsonType: 'date' },
            finalidadeTratamento: { bsonType: 'string' },
            responsavelTratamento: { bsonType: 'string' },
            anonimizado: { bsonType: 'bool' },
            dataExclusaoSolicitada: { bsonType: 'date' }
          }
        },
        hash_integridade: { 
          bsonType: 'string',
          description: 'SHA-256 do documento — integridade LGPD'
        },
        criado_em: { bsonType: 'date' },
        atualizado_em: { bsonType: 'date' }
      }
    }
  }
});

// Índices - historico_clinicos
db.historico_clinicos.createIndex({ paciente_id: 1 }, { unique: true });
db.historico_clinicos.createIndex({ "alergias_conhecidas.severidade": 1 });
db.historico_clinicos.createIndex({ "metadados_lgpd.dataExclusaoSolicitada": 1 });

// =====================
// Coleção: consultas_laudos
// =====================
db.createCollection('consultas_laudos', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['atendimento_id', 'historico_id', 'paciente_id', 'medico_id', 'data_registro', 'tipo_registro', 'descricao_clinica', 'hash_integridade', 'criado_em', 'atualizado_em'],
      properties: {
        atendimento_id: { bsonType: 'string' },
        historico_id: { bsonType: 'string' },
        paciente_id: { bsonType: 'string' },
        medico_id: { bsonType: 'string' },
        data_registro: { bsonType: 'date' },
        tipo_registro: {
          bsonType: 'string',
          enum: ['TRIAGEM', 'CONSULTA', 'EVOLUCAO', 'LAUDO', 'PRESCRICAO', 'ALTA']
        },
        descricao_clinica: { bsonType: 'string' },
        prescricoes: {
          bsonType: ['array', 'null'],
          items: {
            bsonType: 'object',
            required: ['medicamento', 'dose', 'frequencia'],
            properties: {
              medicamento: { bsonType: 'string' },
              dose: { bsonType: 'string' },
              frequencia: { bsonType: 'string' },
              duracao: { bsonType: 'string' }
            }
          }
        },
        exames_anexos: {
          bsonType: ['array', 'null'],
          items: {
            bsonType: 'object',
            required: ['tipo'],
            properties: {
              tipo: { bsonType: 'string' },
              descricao: { bsonType: 'string' },
              urlAnexo: { bsonType: 'string' },
              dataRealizacao: { bsonType: 'date' }
            }
          }
        },
        novas_alergias_identificadas: {
          bsonType: ['array', 'null'],
          items: {
            bsonType: 'object',
            required: ['substancia', 'severidade'],
            properties: {
              substancia: { bsonType: 'string' },
              severidade: { bsonType: 'string', enum: ['leve', 'moderada', 'grave'] },
              reacao: { bsonType: 'string' }
            }
          }
        },
        hash_integridade: { bsonType: 'string' },
        criado_em: { bsonType: 'date' },
        atualizado_em: { bsonType: 'date' }
      }
    }
  }
});

// Índices - consultas_laudos
db.consultas_laudos.createIndex({ atendimento_id: 1 }); // Removido o unique (1:N)
db.consultas_laudos.createIndex({ paciente_id: 1 }); // Otimiza buscas por paciente e exclusão LGPD
db.consultas_laudos.createIndex({ tipo_registro: 1 });
db.consultas_laudos.createIndex({ medico_id: 1, data_registro: -1 });

print('MongoDB initialization complete: pep_nao_relacional ready');