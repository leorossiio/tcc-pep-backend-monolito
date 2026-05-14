import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

export class CreateMedicoDto {
  @ApiProperty({ description: 'Nome completo do médico' })
  @IsString()
  @IsNotEmpty()
  nomeCompleto!: string;

  @ApiProperty({ description: 'CRM do médico (único por estado, ex: 123456/SP)' })
  @IsString()
  @IsNotEmpty()
  crm!: string;

  @ApiProperty({ description: 'Especialidade médica (ex: Clínica Geral, Cardiologia)' })
  @IsString()
  @IsNotEmpty()
  especialidade!: string;

  @ApiPropertyOptional({
    description: 'Indica se o médico está ativo no sistema',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  ativo?: boolean;
}
