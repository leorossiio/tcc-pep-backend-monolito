import { PartialType } from '@nestjs/swagger';
import { CreateConsultaLaudoDto } from './create-consulta-laudo.dto';

export class UpdateConsultaLaudoDto extends PartialType(CreateConsultaLaudoDto) {}
