import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicosController } from './controllers/medicos.controller';
import { MedicosService } from './services/medicos.service';
import { MedicosRepository } from './repositories/medicos.repository';
import { Medico } from './entities/medico.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Medico])],
  controllers: [MedicosController],
  providers: [MedicosService, MedicosRepository],
  exports: [MedicosService, MedicosRepository],
})
export class MedicosModule {}
