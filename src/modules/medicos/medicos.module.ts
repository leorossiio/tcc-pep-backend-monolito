import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicosController } from './controllers/medicos.controller';
import { MedicosService } from './services/medicos.service';
import { MedicosRepository } from './repositories/medicos.repository';
import { Medico } from './entities/medico.entity';
import { AtendimentosModule } from '../atendimentos/atendimentos.module';
import { ConsultasLaudosModule } from '../consultas-laudos/consultas-laudos.module';

@Module({
  imports: [TypeOrmModule.forFeature([Medico]), AtendimentosModule, ConsultasLaudosModule],
  controllers: [MedicosController],
  providers: [MedicosService, MedicosRepository],
  exports: [MedicosService, MedicosRepository],
})
export class MedicosModule {}
