import { PartialType } from '@nestjs/swagger';
import { CreateLogAuditoriaDto } from './create-log-auditoria.dto';

export class UpdateLogAuditoriaDto extends PartialType(CreateLogAuditoriaDto) {}