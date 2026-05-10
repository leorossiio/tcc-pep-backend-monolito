import { Module } from '@nestjs/common';
import { MedicosController } from './controllers/medicos.controller';
import { MedicosService } from './services/medicos.service';

@Module({
  controllers: [MedicosController],
  providers: [MedicosService]
})
export class MedicosModule {}
