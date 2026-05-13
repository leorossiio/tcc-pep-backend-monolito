import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Paciente } from './entities/paciente.entity';
import { PacientesController } from './controllers/pacientes.controller';
import { PacientesService } from './services/pacientes.service';
import { PacientesRepository } from './repositories/pacientes.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Paciente])],
  controllers: [PacientesController],
  providers: [PacientesService, PacientesRepository],
})
export class PacientesModule {}

