import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

export class Prescricao {
  medicamento!: string;
  dose!: string;
  frequencia!: string;
  duracao?: string;
}

export class ExameAnexo {
  tipo!: string;
  descricao?: string;
  urlAnexo?: string;
  dataRealizacao?: Date;
}

export class NovaAlergia {
  substancia!: string;
  severidade!: 'leve' | 'moderada' | 'grave';
  reacao?: string;
}

// ─── Tipo do documento Mongoose ──────────────────────────────────────────────
export type ConsultaLaudoDocument = ConsultaLaudo & Document;

@Schema({
  collection: 'consultas_laudos',
  timestamps: { createdAt: 'criado_em', updatedAt: 'atualizado_em' },
})
export class ConsultaLaudo {
  /**
   * FK lógica para o UUID do atendimento no PostgreSQL.
   * Vincula este laudo ao atendimento de origem — chave do join poliglota.
   */
  @Prop({ type: String, required: true, index: true })
  atendimentoId!: string;

  /**
   * FK lógica para o _id do documento de histórico clínico no MongoDB.
   * Permite navegar do laudo ao histórico sem passar pelo Postgres.
   */
  @Prop({ type: String, required: true })
  historicoId!: string;

  /**
   * UUID do médico responsável pelo laudo — referência ao PostgreSQL.
   */
  @Prop({ type: String, required: true })
  medicoId!: string;

  /**
   * Data e hora do registro do laudo/consulta.
   */
  @Prop({ type: Date, required: true })
  dataRegistro!: Date;

  /**
   * Tipo do registro — ex: "CONSULTA", "LAUDO", "EVOLUCAO", "ALTA".
   * Permite filtrar documentos por categoria sem full scan.
   */
  @Prop({ type: String, required: true, index: true })
  tipoRegistro!: string;

  /**
   * Descrição clínica em texto livre (campo pesado).
   * Principal motivo de estar no MongoDB — pode ser longa e semiestruturada.
   */
  @Prop({ type: String, required: true })
  descricaoClinica!: string;

  /**
   * Lista de prescrições médicas — array de objetos aninhados.
   * Sem tabela separada, ao contrário do que exigiria o Postgres.
   */
  @Prop({
    type: [
      {
        medicamento: { type: String, required: true },
        dose: { type: String, required: true },
        frequencia: { type: String, required: true },
        duracao: { type: String },
      },
    ],
    default: [],
  })
  prescricoes!: Prescricao[];

  /**
   * Exames solicitados ou resultados anexados.
   */
  @Prop({
    type: [
      {
        tipo: { type: String, required: true },
        descricao: { type: String },
        urlAnexo: { type: String },
        dataRealizacao: { type: Date },
      },
    ],
    default: [],
  })
  examesAnexos!: ExameAnexo[];

  /**
   * Novas alergias identificadas durante a consulta.
   * Dado que eventualmente deve ser propagado ao histórico clínico do paciente.
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
  novasAlergiasIdentificadas!: NovaAlergia[];
}

export const ConsultaLaudoSchema = SchemaFactory.createForClass(ConsultaLaudo);

// ─── Índices ──────────────────────────────────────────────────────────────────

// Busca de todos os laudos de um atendimento (1:N — um atendimento pode ter vários laudos)
ConsultaLaudoSchema.index({ atendimentoId: 1 });

// Filtro por tipo de registro (CONSULTA, LAUDO, EVOLUCAO, etc.)
ConsultaLaudoSchema.index({ tipoRegistro: 1 });

// Ordenação cronológica por médico — útil para relatórios analíticos no benchmark
ConsultaLaudoSchema.index({ medicoId: 1, dataRegistro: -1 });
