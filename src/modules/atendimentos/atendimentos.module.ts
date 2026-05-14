import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Atendimento } from './entities/atendimento.entity';
import { AtendimentosController } from './controllers/atendimentos.controller';
import { AtendimentosService } from './services/atendimentos.service';
import { AtendimentosRepository } from './repositories/atendimentos.repository';
import { ConsultasLaudosModule } from '../consultas-laudos/consultas-laudos.module';
import { HistoricoClinicosModule } from '../historico-clinicos/historico-clinicos.module';

@Module({
  imports: [
    // Registra a entidade Atendimento no TypeORM para que o InjectRepository funcione
    TypeOrmModule.forFeature([Atendimento]),
    // Importa o módulo MongoDB para o dual-write e join poliglota
    ConsultasLaudosModule,
    // Importa o módulo de histórico clínico para buscar o _id correto no dual-write
    HistoricoClinicosModule,
  ],
  controllers: [AtendimentosController],
  providers: [
    AtendimentosService,
    AtendimentosRepository,
  ],
  exports: [AtendimentosService],
})
export class AtendimentosModule {}
