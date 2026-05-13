import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsUUID, 
  IsNotEmpty, 
  IsString, 
  IsOptional, 
  IsInt, 
  IsNumber, 
  IsDateString, 
  IsEnum, 
  Min, 
  Max 
} from 'class-validator';
import { RiscoManchester } from '../entities/atendimento.entity'; // Ajuste o caminho se necessário

export class CreateAtendimentoDto {
  @ApiProperty({ description: 'ID do paciente (UUID)' })
  @IsUUID()
  @IsNotEmpty()
  pacienteId!: string;

  @ApiProperty({ description: 'ID do médico responsável pela triagem (UUID)' })
  @IsUUID()
  @IsNotEmpty()
  medicoTriagemId!: string;

  @ApiProperty({ description: 'Data e hora da entrada no formato ISO 8601 (ex: 2026-05-11T14:30:00Z)' })
  @IsDateString()
  @IsNotEmpty()
  dataHoraEntrada!: string;

  @ApiProperty({ description: 'Queixa principal relatada' })
  @IsString()
  @IsNotEmpty()
  queixaPrincipal!: string;

  @ApiPropertyOptional({ description: 'Pressão arterial (ex: 120/80)' })
  @IsString()
  @IsOptional()
  pressaoArterial?: string;

  @ApiPropertyOptional({ description: 'Frequência cardíaca em bpm' })
  @IsInt()
  @Min(0)
  @IsOptional()
  frequenciaCardiaca?: number;

  @ApiPropertyOptional({ description: 'Saturação de oxigênio em %' })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  saturacaoOxigenio?: number;

  @ApiPropertyOptional({ description: 'Temperatura corporal em °C' })
  @IsNumber()
  @IsOptional()
  temperaturaCorporal?: number;

  @ApiPropertyOptional({ description: 'Frequência respiratória em irpm' })
  @IsInt()
  @Min(0)
  @IsOptional()
  frequenciaRespiratoria?: number;

  @ApiProperty({ enum: RiscoManchester, description: 'Classificação de risco de Manchester' })
  @IsEnum(RiscoManchester)
  @IsNotEmpty()
  classificacaoRisco!: RiscoManchester;
}