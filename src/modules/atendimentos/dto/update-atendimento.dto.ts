import { PartialType } from '@nestjs/swagger';
import { CreateAtendimentoDto } from './create-atendimento.dto'; // Ajuste o caminho se necessário

export class UpdateAtendimentoDto extends PartialType(CreateAtendimentoDto) {}