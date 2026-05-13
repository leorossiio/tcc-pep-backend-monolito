import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsBoolean,
  IsOptional,
} from 'class-validator';

export class CreatePacienteDto {
  @ApiProperty({ description: 'Nome completo do paciente' })
  @IsString()
  @IsNotEmpty()
  nomeCompleto!: string;

  @ApiProperty({ description: 'Sexo do paciente (ex: M, F, Outro)' })
  @IsString()
  @IsNotEmpty()
  sexo!: string;

  @ApiProperty({ description: 'CPF do paciente (será armazenado como hash)' })
  @IsString()
  @IsNotEmpty()
  cpf!: string;

  @ApiProperty({ description: 'Data de nascimento no formato ISO 8601 (ex: 1990-05-12)' })
  @IsDateString()
  @IsNotEmpty()
  dataNascimento!: string;

  @ApiPropertyOptional({ description: 'Telefone de contato' })
  @IsString()
  @IsOptional()
  telefoneContato?: string;

  @ApiPropertyOptional({ description: 'Tipagem sanguínea (ex: A+, O-)' })
  @IsString()
  @IsOptional()
  tipagemSanguinea?: string;

  @ApiProperty({ description: 'Consentimento LGPD confirmado pelo paciente' })
  @IsBoolean()
  @IsNotEmpty()
  consentimentoLgpd!: boolean;
}
