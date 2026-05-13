import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateLogAuditoriaDto {
  @ApiProperty({ description: 'ID do atendimento vinculado ao log', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  atendimentoId!: string;

  @ApiProperty({ description: 'Descrição da ação realizada no sistema' })
  @IsString()
  @IsNotEmpty()
  acaoRealizada!: string;

  @ApiPropertyOptional({ description: 'IP de origem da requisição' })
  @IsString()
  @IsOptional()
  ipOrigem?: string;
}