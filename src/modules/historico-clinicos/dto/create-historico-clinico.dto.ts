import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Sub-DTOs ─────────────────────────────────────────────────────────────────

export class AlergiaDto {
  @IsString() @IsNotEmpty()
  substancia!: string;

  @IsEnum(['leve', 'moderada', 'grave'])
  severidade!: 'leve' | 'moderada' | 'grave';

  @IsString() @IsOptional()
  reacao?: string;
}

export class ComorbidadeDto {
  @IsString() @IsNotEmpty()
  descricao!: string;

  @IsString() @IsOptional()
  cid10?: string;

  @IsDateString() @IsOptional()
  dataDiagnostico?: Date;

  @IsBoolean()
  ativa!: boolean;
}

export class TipoSanguineoIncompativelDto {
  @IsString() @IsNotEmpty()
  tipo!: string;

  @IsString() @IsOptional()
  motivo?: string;
}

export class MetadadosLgpdDto {
  @IsBoolean()
  consentimentoColetado!: boolean;

  @IsDateString() @IsOptional()
  dataConsentimento?: Date;

  @IsString() @IsNotEmpty()
  finalidadeTratamento!: string;

  @IsString() @IsNotEmpty()
  responsavelTratamento!: string;

  @IsBoolean()
  anonimizado!: boolean;

  @IsDateString() @IsOptional()
  dataExclusaoSolicitada?: Date;
}

// ─── DTO principal ────────────────────────────────────────────────────────────
export class CreateHistoricoClinicoDto {
  /**
   * UUID do paciente no PostgreSQL — FK lógica (1:1 com a tabela de pacientes).
   * Este documento é criado no cadastro do paciente, não no atendimento.
   */
  @ApiProperty({ description: 'UUID do paciente no PostgreSQL (FK lógica)' })
  @IsString()
  @IsNotEmpty()
  pacienteId!: string;

  @ApiPropertyOptional({ type: [AlergiaDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AlergiaDto)
  @IsOptional()
  alergiasConhecidas?: AlergiaDto[];

  @ApiPropertyOptional({ type: [ComorbidadeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComorbidadeDto)
  @IsOptional()
  comorbidadesPrevias?: ComorbidadeDto[];

  @ApiPropertyOptional({ type: [TipoSanguineoIncompativelDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TipoSanguineoIncompativelDto)
  @IsOptional()
  tiposSanguineosIncompativeis?: TipoSanguineoIncompativelDto[];

  @ApiProperty({ type: MetadadosLgpdDto, description: 'Metadados de conformidade LGPD (obrigatório)' })
  @ValidateNested()
  @Type(() => MetadadosLgpdDto)
  metadadosLgpd!: MetadadosLgpdDto;
}
