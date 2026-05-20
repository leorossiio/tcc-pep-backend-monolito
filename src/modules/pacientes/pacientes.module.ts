import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Paciente } from './entities/paciente.entity';
import { PacientesController } from './controllers/pacientes.controller';
import { PacientesService } from './services/pacientes.service';
import { PacientesRepository } from './repositories/pacientes.repository';
import { AtendimentosModule } from '../atendimentos/atendimentos.module';
import { HistoricoClinicosModule } from '../historico-clinicos/historico-clinicos.module';
import { LogsAuditoriaModule } from '../logs-auditoria/logs-auditoria.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Paciente]),
    AtendimentosModule,
    HistoricoClinicosModule,
    LogsAuditoriaModule,
  ],
  controllers: [PacientesController],
  providers: [PacientesService, PacientesRepository],
})
export class PacientesModule {}
