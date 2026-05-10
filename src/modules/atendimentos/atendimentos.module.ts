import { Module } from '@nestjs/common';
import { AtendimentosController } from './controllers/atendimentos.controller';
import { AtendimentosService } from './services/atendimentos.service';

@Module({
  controllers: [AtendimentosController],
  providers: [AtendimentosService]
})
export class AtendimentosModule {}
