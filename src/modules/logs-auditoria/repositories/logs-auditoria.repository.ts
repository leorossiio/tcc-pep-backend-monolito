import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LogAuditoria } from '../entities/logs-auditoria.entity';

@Injectable()
export class LogsAuditoriaRepository {
  constructor(
    @InjectRepository(LogAuditoria)
    private readonly repo: Repository<LogAuditoria>,
  ) {}

  findAll(): Promise<LogAuditoria[]> {
    return this.repo.find();
  }

  findOne(id: string): Promise<LogAuditoria | null> {
    return this.repo.findOneBy({ id });
  }

  findByAtendimentoId(atendimentoId: string): Promise<LogAuditoria[]> {
    return this.repo.findBy({ atendimentoId });
  }

  save(log: LogAuditoria): Promise<LogAuditoria> {
    return this.repo.save(log);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}