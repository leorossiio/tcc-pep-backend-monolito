import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogAuditoria } from './entities/logs-auditoria.entity';
import { LogsAuditoriaService } from './services/logs-auditoria.service';
import { LogsAuditoriaRepository } from './repositories/logs-auditoria.repository';
import { LogsAuditoriaController } from './controllers/logs-auditoria.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LogAuditoria])],
  controllers: [LogsAuditoriaController],
  providers: [LogsAuditoriaService, LogsAuditoriaRepository],
  exports: [LogsAuditoriaService],
})
export class LogsAuditoriaModule {}
