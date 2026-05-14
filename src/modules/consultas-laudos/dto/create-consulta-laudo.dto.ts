import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsDateString,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Sub-DTOs ─────────────────────────────────────────────────────────────────

export class PrescricaoDto {
  @IsString() @IsNotEmpty()
  medicamento!: string;

  @IsString() @IsNotEmpty()
  dose!: string;

  @IsString() @IsNotEmpty()
  frequencia!: string;

  @IsString() @IsOptional()
  duracao?: string;
}

export class ExameAnexoDto {
  @IsString() @IsNotEmpty()
  tipo!: string;

  @IsString() @IsOptional()
  descricao?: string;

  @IsString() @IsOptional()
  urlAnexo?: string;

  @IsDateString() @IsOptional()
  dataRealizacao?: Date;
}

export class NovaAlergiaDto {
  @IsString() @IsNotEmpty()
  substancia!: string;

  @IsEnum(['leve', 'moderada', 'grave'])
  severidade!: 'leve' | 'moderada' | 'grave';

  @IsString() @IsOptional()
  reacao?: string;
}

// ─── DTO principal ────────────────────────────────────────────────────────────
export class CreateConsultaLaudoDto {
  /**
   * UUID do atendimento no PostgreSQL — FK lógica principal.
   * É a chave do join poliglota: GET /atendimentos/:id busca aqui.
   */
  @ApiProperty({ description: 'UUID do atendimento no PostgreSQL (FK lógica)' })
  @IsString()
  @IsNotEmpty()
  atendimentoId!: string;

  /**
   * _id do documento HistoricoClinico no MongoDB.
   * Permite navegar do laudo ao histórico permanente sem passar pelo Postgres.
   */
  @ApiProperty({ description: '_id do histórico clínico no MongoDB (FK lógica)' })
  @IsString()
  @IsNotEmpty()
  historicoId!: string;

  @ApiProperty({ description: 'UUID do médico responsável no PostgreSQL' })
  @IsString()
  @IsNotEmpty()
  medicoId!: string;

  @ApiProperty({ description: 'Data e hora do registro' })
  @IsDateString()
  @IsNotEmpty()
  dataRegistro!: Date;

  @ApiProperty({ description: 'Tipo do registro: TRIAGEM, CONSULTA, LAUDO, EVOLUCAO, ALTA' })
  @IsString()
  @IsNotEmpty()
  tipoRegistro!: string;

  @ApiProperty({ description: 'Descrição clínica em texto livre (campo pesado)' })
  @IsString()
  @IsNotEmpty()
  descricaoClinica!: string;

  @ApiPropertyOptional({ type: [PrescricaoDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescricaoDto)
  @IsOptional()
  prescricoes?: PrescricaoDto[];

  @ApiPropertyOptional({ type: [ExameAnexoDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExameAnexoDto)
  @IsOptional()
  examesAnexos?: ExameAnexoDto[];

  @ApiPropertyOptional({ type: [NovaAlergiaDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NovaAlergiaDto)
  @IsOptional()
  novasAlergiasIdentificadas?: NovaAlergiaDto[];
}