import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Paciente } from './entities/paciente.entity';
import { PacientesController } from './controllers/pacientes.controller';
import { PacientesService } from './services/pacientes.service';
import { PacientesRepository } from './repositories/pacientes.repository';
import { AtendimentosModule } from '../atendimentos/atendimentos.module';
import { HistoricoClinicosModule } from '../historico-clinicos/historico-clinicos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Paciente]),
    AtendimentosModule,
    HistoricoClinicosModule,
  ],
  controllers: [PacientesController],
  providers: [PacientesService, PacientesRepository],
})
export class PacientesModule {}