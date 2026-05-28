import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicosController } from './controllers/medicos.controller';
import { MedicosService } from './services/medicos.service';
import { MedicosRepository } from './repositories/medicos.repository';
import { Medico } from './entities/medico.entity';
import { AtendimentosModule } from '../atendimentos/atendimentos.module';
import { ConsultasLaudosModule } from '../consultas-laudos/consultas-laudos.module';
import { LogsAuditoriaModule } from '../logs-auditoria/logs-auditoria.module'; // <-- Importe o módulo

@Module({
  imports: [TypeOrmModule.forFeature([Medico]), AtendimentosModule, ConsultasLaudosModule, LogsAuditoriaModule],
  controllers: [MedicosController],
  providers: [MedicosService, MedicosRepository],
  exports: [MedicosService, MedicosRepository],
})
export class MedicosModule {}
