import { Injectable } from '@nestjs/common';
import { LogsAuditoriaRepository } from '../repositories/logs-auditoria.repository';
import { CreateLogAuditoriaDto } from '../dto/create-log-auditoria.dto';
import { LogAuditoria } from '../entities/logs-auditoria.entity';

/**
 * LogsAuditoriaService — geração AUTOMÁTICA de logs de auditoria.
 *
 * Este service é chamado internamente por outras services do sistema
 * (AtendimentosService, ConsultasLaudosService, HistoricoClinicosService, etc.)
 * sempre que uma ação crítica ocorrer.
 *
 * NUNCA deve ser chamado diretamente por um controller em resposta a um
 * request de criação manual do usuário.
 *
 * Arquitetura preparada para migração futura para EventEmitter2 / Kafka / RabbitMQ:
 *   AtendimentosService.create()
 *     ↓
 *   Atendimento criado
 *     ↓
 *   LogsAuditoriaService.registrar()  ← aqui
 */
@Injectable()
export class LogsAuditoriaService {
  constructor(private readonly logsAuditoriaRepository: LogsAuditoriaRepository) {}

  /**
   * Registra um evento de auditoria de forma automática.
   * Falhas silenciosas — um erro de log nunca deve derrubar o fluxo principal.
   */
  async registrar(dto: CreateLogAuditoriaDto): Promise<void> {
    try {
      const log = new LogAuditoria();
      log.atendimentoId    = dto.atendimentoId ?? null;
      log.acaoRealizada    = dto.acaoRealizada;
      log.ipOrigem         = dto.ipOrigem ?? null;
      log.entidadeAfetada  = dto.entidadeAfetada;
      log.entidadeId       = dto.entidadeId ?? null;
      log.usuarioResponsavel = dto.usuarioResponsavel ?? 'sistema';

      await this.logsAuditoriaRepository.save(log);
    } catch (err) {
      // Log silencioso — auditoria não deve bloquear o fluxo de negócio
      console.error('[LogsAuditoria] Falha ao registrar evento:', err);
    }
  }

  /** Consulta todos os logs — somente leitura via API. */
  findAll(): Promise<LogAuditoria[]> {
    return this.logsAuditoriaRepository.findAll();
  }

  /** Consulta logs de um atendimento específico. */
  findByAtendimento(atendimentoId: string): Promise<LogAuditoria[]> {
    return this.logsAuditoriaRepository.findByAtendimentoId(atendimentoId);
  }

  /** Consulta logs de uma entidade específica (ex: todos os logs de um ConsultaLaudo). */
  findByEntidade(entidade: string, entidadeId: string): Promise<LogAuditoria[]> {
    return this.logsAuditoriaRepository.findByEntidade(entidade, entidadeId);
  }

  /** Busca log por ID. */
  findOne(id: string): Promise<LogAuditoria | null> {
    return this.logsAuditoriaRepository.findOne(id);
  }
}
