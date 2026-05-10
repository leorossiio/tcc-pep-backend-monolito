import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PacientesModule } from './modules/pacientes/pacientes.module';
import { MedicosModule } from './modules/medicos/medicos.module';
import { AtendimentosModule } from './modules/atendimentos/atendimentos.module';
import { LogsAuditoriaModule } from './modules/logs-auditoria/logs-auditoria.module';
import { HistoricoClinicosModule } from './modules/historico-clinicos/historico-clinicos.module';
import { ConsultasLaudosModule } from './modules/consultas-laudos/consultas-laudos.module';

@Module({
  imports: [PacientesModule, MedicosModule, AtendimentosModule, LogsAuditoriaModule, HistoricoClinicosModule, ConsultasLaudosModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
