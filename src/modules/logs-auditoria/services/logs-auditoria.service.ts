import { Injectable, NotFoundException } from '@nestjs/common';
import { LogsAuditoriaRepository } from '../repositories/logs-auditoria.repository';
import { CreateLogAuditoriaDto } from '../dto/create-log-auditoria.dto';
import { UpdateLogAuditoriaDto } from '../dto/update-log-auditoria.dto';
import { LogAuditoria } from '../entities/logs-auditoria.entity';

@Injectable()
export class LogsAuditoriaService {
  constructor(private readonly logsAuditoriaRepository: LogsAuditoriaRepository) {}

  async create(dto: CreateLogAuditoriaDto): Promise<LogAuditoria> {
    const log = new LogAuditoria();
    log.atendimentoId = dto.atendimentoId;
    log.acaoRealizada = dto.acaoRealizada;
    log.ipOrigem = dto.ipOrigem ?? null;

    return this.logsAuditoriaRepository.save(log);
  }

  findAll(): Promise<LogAuditoria[]> {
    return this.logsAuditoriaRepository.findAll();
  }

  async findOne(id: string): Promise<LogAuditoria> {
    const log = await this.logsAuditoriaRepository.findOne(id);
    if (!log) {
      throw new NotFoundException(`Log de auditoria #${id} não encontrado`);
    }
    return log;
  }

  findByAtendimento(atendimentoId: string): Promise<LogAuditoria[]> {
    return this.logsAuditoriaRepository.findByAtendimentoId(atendimentoId);
  }

  async update(id: string, dto: UpdateLogAuditoriaDto): Promise<LogAuditoria> {
    const log = await this.findOne(id);

    if (dto.atendimentoId) log.atendimentoId = dto.atendimentoId;
    if (dto.acaoRealizada) log.acaoRealizada = dto.acaoRealizada;
    if (dto.ipOrigem !== undefined) log.ipOrigem = dto.ipOrigem ?? null;

    return this.logsAuditoriaRepository.save(log);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.logsAuditoriaRepository.remove(id);
  }
}