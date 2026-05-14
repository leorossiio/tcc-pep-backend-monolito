import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ConsultaLaudo,
  ConsultaLaudoSchema,
} from './schemas/consulta-laudo.schema';
import { ConsultasLaudosRepository } from './repositories/consultas-laudos.repository';
import { ConsultasLaudosService } from './services/consultas-laudos.service';
import { ConsultasLaudosController } from './controllers/consultas-laudos.controller';

@Module({
  imports: [
    // Registra o schema Mongoose para que o @InjectModel funcione no repository
    MongooseModule.forFeature([
      { name: ConsultaLaudo.name, schema: ConsultaLaudoSchema },
    ]),
  ],
  controllers: [ConsultasLaudosController],
  providers: [ConsultasLaudosService, ConsultasLaudosRepository],
  // Exporta o service para ser injetado no AtendimentosModule (dual-write + join poliglota)
  exports: [ConsultasLaudosService],
})
export class ConsultasLaudosModule {}
