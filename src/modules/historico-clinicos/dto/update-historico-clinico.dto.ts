import { PartialType } from '@nestjs/swagger';
import { CreateHistoricoClinicoDto } from './create-historico-clinico.dto';

export class UpdateHistoricoClinicoDto extends PartialType(CreateHistoricoClinicoDto) {}
