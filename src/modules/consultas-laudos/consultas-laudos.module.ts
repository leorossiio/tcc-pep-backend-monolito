import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ConsultaLaudo,
  ConsultaLaudoSchema,
} from './schemas/consulta-laudo.schema';
import { ConsultasLaudosRepository } from './repositories/consultas-laudos.repository';
import { ConsultasLaudosService } from './services/consultas-laudos.service';
import { ConsultasLaudosController } from './controllers/consultas-laudos.controller';
import { HistoricoClinicosModule } from '../historico-clinicos/historico-clinicos.module';
import { LogsAuditoriaModule } from '../logs-auditoria/logs-auditoria.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ConsultaLaudo.name, schema: ConsultaLaudoSchema },
    ]),
    HistoricoClinicosModule,
    LogsAuditoriaModule,
  ],
  controllers: [ConsultasLaudosController],
  providers: [ConsultasLaudosService, ConsultasLaudosRepository],
  exports: [ConsultasLaudosService],
})
export class ConsultasLaudosModule {}
