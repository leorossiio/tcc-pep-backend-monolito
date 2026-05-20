import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Atendimento } from './entities/atendimento.entity';
import { AtendimentosController } from './controllers/atendimentos.controller';
import { AtendimentosService } from './services/atendimentos.service';
import { AtendimentosRepository } from './repositories/atendimentos.repository';
import { ConsultasLaudosModule } from '../consultas-laudos/consultas-laudos.module';
import { HistoricoClinicosModule } from '../historico-clinicos/historico-clinicos.module';
import { LogsAuditoriaModule } from '../logs-auditoria/logs-auditoria.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Atendimento]),
    ConsultasLaudosModule,
    HistoricoClinicosModule,
    LogsAuditoriaModule,
  ],
  controllers: [AtendimentosController],
  providers: [AtendimentosService, AtendimentosRepository],
  exports: [AtendimentosService],
})
export class AtendimentosModule {}
