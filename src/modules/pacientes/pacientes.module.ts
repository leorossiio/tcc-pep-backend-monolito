import { Module } from '@nestjs/common';
import { PacientesController } from './controllers/pacientes.controller';
import { PacientesService } from './services/pacientes.service';

@Module({
  controllers: [PacientesController],
  providers: [PacientesService]
})
export class PacientesModule {}
