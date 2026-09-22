import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { AtendimentosRepository } from '../repositories/atendimentos.repository';
import { ConsultasLaudosService } from '../../consultas-laudos/services/consultas-laudos.service';
import { HistoricoClinicosService } from '../../historico-clinicos/services/historico-clinicos.service';
import { LogsAuditoriaService } from '../../logs-auditoria/services/logs-auditoria.service';
import { Atendimento } from '../entities/atendimento.entity';
import { CreateAtendimentoDto } from '../dto/create-atendimento.dto';
import { UpdateAtendimentoDto } from '../dto/update-atendimento.dto';

/**
 * AtendimentosService — orquestra o fluxo de triagem hospitalar
 * Fluxo completo do create():
 *   1. Salva o atendimento no PostgreSQL
 *   2. Cria (ou obtém) o histórico clínico do paciente no MongoDB (automático)
 *   3. Cria o documento de TRIAGEM no MongoDB (consultas-laudos)
 *   4. Registra log de auditoria automaticamente
 */
@Injectable()
export class AtendimentosService {
  constructor(
    private readonly atendimentosRepository: AtendimentosRepository,
    private readonly consultasLaudosService: ConsultasLaudosService,
    private readonly historicoClinicosService: HistoricoClinicosService,
    private readonly logsAuditoriaService: LogsAuditoriaService,
  ) {}

  // Helper: extrai o IP real do request (quando disponível via contexto)
  private extractIp(req?: Request): string | null {
    if (!req) return null;
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    }
    return req.socket?.remoteAddress ?? null;
  }

  // CREATE — Triagem + dual-write + histórico automático + auditoria
  async create(dto: CreateAtendimentoDto, req?: Request) {
    // 1. Persistir atendimento no PostgreSQL
    let atendimentoSalvo: Atendimento;
    try {
      atendimentoSalvo = await this.atendimentosRepository.create(dto);
    } catch {
      throw new InternalServerErrorException(
        'Falha ao persistir atendimento no PostgreSQL',
      );
    }

    // 2. Criar ou obter o histórico clínico do paciente no MongoDB (idempotente)
    const historico = await this.historicoClinicosService.criarOuObter({
      pacienteId: dto.pacienteId,
      metadadosLgpd: {
        consentimentoColetado: true,
        dataConsentimento: new Date(),
        finalidadeTratamento: 'Assistência médica e continuidade do cuidado',
        responsavelTratamento: dto.medicoTriagemId,
        anonimizado: false,
      },
    });

    // 3. Criar documento de TRIAGEM no MongoDB (consultas-laudos)
    try {
      await this.consultasLaudosService.create({
        atendimentoId: atendimentoSalvo.id,
        historicoId: String(historico._id),
        medicoId: dto.medicoTriagemId,
        dataRegistro: new Date(),
        tipoRegistro: 'TRIAGEM',
        descricaoClinica: dto.queixaPrincipal,
        pacienteId: dto.pacienteId,
      });
    } catch {
      throw new InternalServerErrorException(
        'Falha ao persistir triagem no MongoDB',
      );
    }

    // 4. Auditoria automática (fire-and-forget — não bloqueia o response)
    this.logsAuditoriaService.registrar({
      atendimentoId: atendimentoSalvo.id,
      acaoRealizada: `Triagem criada — risco ${dto.classificacaoRisco} — queixa: ${dto.queixaPrincipal}`,
      ipOrigem: this.extractIp(req),
      entidadeAfetada: 'Atendimento',
      entidadeId: atendimentoSalvo.id,
      usuarioResponsavel: dto.medicoTriagemId,
    });

    return { success: true, atendimentoId: atendimentoSalvo.id };
  }

  // READ
  async findAll() {
    return this.atendimentosRepository.findAll();
  }

  async findByPacienteId(pacienteId: string): Promise<Atendimento[]> {
    return this.atendimentosRepository.findByPacienteId(pacienteId);
  }

  async findComLaudosByMedicoId(medicoId: string) {
    const atendimentos =
      await this.atendimentosRepository.findByMedicoTriagemId(medicoId);
    return Promise.all(
      atendimentos.map(async (a) => ({
        ...a,
        consultasLaudos: await this.consultasLaudosService.findByAtendimentoId(
          a.id,
        ),
      })),
    );
  }

  async findByIds(ids: string[]): Promise<Atendimento[]> {
    return this.atendimentosRepository.findByIds(ids);
  }

  /**
   * Join poliglota por paciente — sem N+1.
   * Busca todos os atendimentos (PG) e todos os laudos (MongoDB) do paciente
   * em apenas duas queries e agrupa os laudos por atendimentoId em memória.
   */
  async findComLaudosByPacienteId(pacienteId: string) {
    const atendimentos =
      await this.atendimentosRepository.findByPacienteId(pacienteId);
    const laudos = await this.consultasLaudosService.findByAtendimentoIds(
      atendimentos.map((a) => a.id),
    );

    const laudosPorAtendimento = new Map<string, typeof laudos>();
    for (const laudo of laudos) {
      const existentes = laudosPorAtendimento.get(laudo.atendimentoId) ?? [];
      existentes.push(laudo);
      laudosPorAtendimento.set(laudo.atendimentoId, existentes);
    }

    return atendimentos.map((a) => ({
      ...a,
      consultasLaudos: laudosPorAtendimento.get(a.id) ?? [],
    }));
  }

  /** Join poliglota: atendimento (PG) + consultas/laudos (MDB) */
  async findOne(id: string) {
    const [atendimento, consultasLaudos] = await Promise.all([
      this.atendimentosRepository.findOneById(id),
      this.consultasLaudosService.findByAtendimentoId(id),
    ]);
    if (!atendimento) {
      throw new NotFoundException(`Atendimento com ID "${id}" não encontrado`);
    }
    return { ...atendimento, consultasLaudos };
  }

  // UPDATE + auditoria automática
  async update(id: string, dto: UpdateAtendimentoDto, req?: Request) {
    const atendimento = await this.atendimentosRepository.findOneById(id);
    if (!atendimento) {
      throw new NotFoundException(`Atendimento com ID "${id}" não encontrado`);
    }

    const atualizado = await this.atendimentosRepository.update(id, dto);

    const campos = Object.keys(dto).join(', ');
    this.logsAuditoriaService.registrar({
      atendimentoId: id,
      acaoRealizada: `Atendimento atualizado — campos: ${campos}`,
      ipOrigem: this.extractIp(req),
      entidadeAfetada: 'Atendimento',
      entidadeId: id,
      usuarioResponsavel: null,
    });

    return atualizado;
  }

  /**
   * Remocao em cascata dos atendimentos de um paciente (LGPD art. 18, VI).
   * Sem transacao distribuida: apaga o MongoDB primeiro e o PostgreSQL depois.
   * Se o segundo passo falhar sobra atendimento sem laudo — inconsistencia
   * detectavel — em vez de documento clinico orfao, que seria invisivel.
   */
  async removeByPacienteId(pacienteId: string): Promise<number> {
    const atendimentos =
      await this.atendimentosRepository.findByPacienteId(pacienteId);
    if (atendimentos.length === 0) return 0;

    const ids = atendimentos.map((a) => a.id);
    await this.consultasLaudosService.removeByAtendimentoIds(ids);
    await this.logsAuditoriaService.desvincularAtendimentos(ids);
    await this.atendimentosRepository.removeByPacienteId(pacienteId);
    return atendimentos.length;
  }

  // DELETE + auditoria automática
  async remove(id: string, req?: Request) {
    const atendimento = await this.atendimentosRepository.findOneById(id);
    if (!atendimento) {
      throw new NotFoundException(`Atendimento com ID "${id}" não encontrado`);
    }

    // Os documentos clinicos (MongoDB) saem junto — senao ficam orfaos,
    // invisiveis para a API e fora do alcance do direito a elimincao (LGPD).
    await this.consultasLaudosService.removeByAtendimentoId(id);
    await this.logsAuditoriaService.desvincularAtendimentos([id]);
    await this.atendimentosRepository.remove(id);

    // atendimentoId fica null: o registro acabou de ser eliminado e a FK do
    // log nao aceitaria a referencia. O id segue rastreavel em entidadeId.
    this.logsAuditoriaService.registrar({
      atendimentoId: null,
      acaoRealizada: `Atendimento removido — documentos clinicos eliminados`,
      ipOrigem: this.extractIp(req),
      entidadeAfetada: 'Atendimento',
      entidadeId: id,
      usuarioResponsavel: null,
    });

    return { success: true, removed: id };
  }
}
