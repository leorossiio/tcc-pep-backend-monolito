import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

export class Alergia {
  substancia!: string;
  severidade!: 'leve' | 'moderada' | 'grave';
  reacao?: string;
}

export class Comorbidade {
  descricao!: string;
  cid10?: string;             // ex: "E11" – Diabetes tipo 2
  dataDiagnostico?: Date;
  ativa!: boolean;
}

export class TipoSanguineoIncompativel {
  tipo!: string;              // ex: "A+", "B-"
  motivo?: string;
}

export class MetadadosLgpd {
  consentimentoColetado!: boolean;
  dataConsentimento?: Date;
  finalidadeTratamento!: string;   // ex: "assistência à saúde"
  responsavelTratamento!: string;  // nome ou CRM do responsável
  anonimizado!: boolean;
  dataExclusaoSolicitada?: Date;
}

// ─── Tipo do documento Mongoose ──────────────────────────────────────────────
export type HistoricoClinicoDocument = HistoricoClinico & Document;

@Schema({
  collection: 'historicos_clinicos',
  timestamps: { createdAt: 'criado_em', updatedAt: 'atualizado_em' },
})
export class HistoricoClinico {
  /**
   * FK lógica para o UUID do paciente no PostgreSQL.
   * Este documento é criado no cadastro do paciente — existe um por paciente (1:1).
   * Diferente de consultas-laudos que é 1:N por atendimento.
   */
  @Prop({ type: String, required: true })
  pacienteId!: string;

  /**
   * Alergias conhecidas do paciente — array opcional de subdocumentos.
   * Pode ser atualizado quando novas alergias são identificadas em consultas.
   */
  @Prop({
    type: [
      {
        substancia: { type: String, required: true },
        severidade: {
          type: String,
          enum: ['leve', 'moderada', 'grave'],
          required: true,
        },
        reacao: { type: String },
      },
    ],
    default: [],
  })
  alergiasConhecidas!: Alergia[];

  /**
   * Comorbidades pré-existentes do paciente.
   */
  @Prop({
    type: [
      {
        descricao: { type: String, required: true },
        cid10: { type: String },
        dataDiagnostico: { type: Date },
        ativa: { type: Boolean, default: true },
      },
    ],
    default: [],
  })
  comorbidadesPrevias!: Comorbidade[];

  /**
   * Tipos sanguíneos incompatíveis — informação crítica para emergências.
   */
  @Prop({
    type: [
      {
        tipo: { type: String, required: true },
        motivo: { type: String },
      },
    ],
    default: [],
  })
  tiposSanguineosIncompativeis!: TipoSanguineoIncompativel[];

  /**
   * Metadados de conformidade LGPD — obrigatório (NN no diagrama).
   * Rastreia consentimento, finalidade e possível solicitação de exclusão.
   */
  @Prop({
    type: {
      consentimentoColetado: { type: Boolean, required: true, default: false },
      dataConsentimento: { type: Date },
      finalidadeTratamento: { type: String, required: true },
      responsavelTratamento: { type: String, required: true },
      anonimizado: { type: Boolean, required: true, default: false },
      dataExclusaoSolicitada: { type: Date },
    },
    required: true,
  })
  metadadosLgpd!: MetadadosLgpd;

  /**
   * Hash SHA-256 do documento — garante integridade do registro clínico (LGPD).
   * Calculado sobre os campos clínicos antes da persistência.
   */
  @Prop({ type: String, required: true })
  hashIntegridade!: string;
}

export const HistoricoClinicoSchema =
  SchemaFactory.createForClass(HistoricoClinico);

// ─── Índices ──────────────────────────────────────────────────────────────────

// 1:1 com o paciente no Postgres
HistoricoClinicoSchema.index({ pacienteId: 1 }, { unique: true });

// Busca por alergias graves — útil em triagens de emergência
HistoricoClinicoSchema.index({ 'alergiasConhecidas.severidade': 1 });

// Auditoria LGPD — localizar registros com solicitação de exclusão pendente
HistoricoClinicoSchema.index({ 'metadadosLgpd.dataExclusaoSolicitada': 1 });

