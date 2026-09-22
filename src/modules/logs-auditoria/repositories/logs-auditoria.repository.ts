import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LogAuditoria } from '../entities/logs-auditoria.entity';

@Injectable()
export class LogsAuditoriaRepository {
  constructor(
    @InjectRepository(LogAuditoria)
    private readonly repo: Repository<LogAuditoria>,
  ) {}

  findAll(): Promise<LogAuditoria[]> {
    return this.repo.find({ order: { dataHora: 'DESC' } });
  }

  findOne(id: string): Promise<LogAuditoria | null> {
    return this.repo.findOneBy({ id });
  }

  findByAtendimentoId(atendimentoId: string): Promise<LogAuditoria[]> {
    return this.repo.find({
      where: { atendimentoId },
      order: { dataHora: 'DESC' },
    });
  }

  findByEntidade(
    entidadeAfetada: string,
    entidadeId: string,
  ): Promise<LogAuditoria[]> {
    return this.repo.find({
      where: { entidadeAfetada, entidadeId },
      order: { dataHora: 'DESC' },
    });
  }

  /**
   * Desvincula os logs dos atendimentos que serao eliminados, em vez de
   * apaga-los: a trilha de auditoria e preservada (LGPD art. 37) enquanto o
   * dado pessoal e eliminado (art. 18, VI). A coluna atendimento_id e nullable
   * justamente para isso.
   */
  async desvincularAtendimentos(atendimentoIds: string[]): Promise<void> {
    if (atendimentoIds.length === 0) return;
    await this.repo.update(
      { atendimentoId: In(atendimentoIds) },
      { atendimentoId: null },
    );
  }

  save(log: LogAuditoria): Promise<LogAuditoria> {
    return this.repo.save(log);
  }
}
