import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  HistoricoClinico,
  HistoricoClinicoSchema,
} from './schemas/historico-clinico.schema';
import { HistoricoClinicosRepository } from './repositories/historico-clinicos.repository';
import { HistoricoClinicosService } from './services/historico-clinicos.service';
import { HistoricoClinicosController } from './controllers/historico-clinicos.controller';

@Module({
  imports: [
    // Registra o schema Mongoose para que o @InjectModel funcione no repository
    MongooseModule.forFeature([
      { name: HistoricoClinico.name, schema: HistoricoClinicoSchema },
    ]),
  ],
  controllers: [HistoricoClinicosController],
  providers: [HistoricoClinicosService, HistoricoClinicosRepository],
  // Exporta o service para ser injetado no AtendimentosModule (dual-write + join poliglota)
  exports: [HistoricoClinicosService],
})
export class HistoricoClinicosModule {}

