import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Request } from 'express';
import { ConsultasLaudosRepository } from '../repositories/consultas-laudos.repository';
import { HistoricoClinicosService } from '../../historico-clinicos/services/historico-clinicos.service';
import { LogsAuditoriaService } from '../../logs-auditoria/services/logs-auditoria.service';
import { CreateConsultaLaudoDto } from '../dto/create-consulta-laudo.dto';
import { ConsultaLaudoDocument } from '../schemas/consulta-laudo.schema';
import { hashDocument } from '../../../common/utils/crypto.util';

/**
 * ConsultasLaudosService — fluxo de consulta médica
 *   1. Persiste o documento no MongoDB
 *   2. Propaga novas alergias ao histórico clínico via pacienteId (correto)
 *   3. Registra log de auditoria (automático)
 */
@Injectable()
export class ConsultasLaudosService {
  constructor(
    private readonly consultasLaudosRepository: ConsultasLaudosRepository,
    private readonly historicoClinicosService: HistoricoClinicosService,
    private readonly logsAuditoriaService: LogsAuditoriaService,
  ) {}

  private extractIp(req?: Request): string | null {
    if (!req) return null;
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    }
    return req.socket?.remoteAddress ?? null;
  }

  async create(
    dto: CreateConsultaLaudoDto,
    req?: Request,
  ): Promise<ConsultaLaudoDocument> {
    // 1. Persistir consulta/laudo no MongoDB
    let documento: ConsultaLaudoDocument;
    try {
      const hashIntegridade = hashDocument(
        dto as unknown as Record<string, unknown>,
      );
      documento = await this.consultasLaudosRepository.create({
        ...dto,
        hashIntegridade,
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'Falha ao persistir consulta/laudo no MongoDB',
      );
    }

    // 2. Propagar novas alergias ao histórico clínico via pacienteId
    //    O histórico usa pacienteId (UUID do PG) como chave única — não o _id do MongoDB.
    if (dto.novasAlergiasIdentificadas && dto.novasAlergiasIdentificadas.length > 0) {
      await this.historicoClinicosService.adicionarAlergias(
        dto.pacienteId,
        dto.novasAlergiasIdentificadas,
      );
    }

    // 3. Auditoria automática (fire-and-forget — não bloqueia o response)
    this.logsAuditoriaService.registrar({
      atendimentoId: dto.atendimentoId,
      acaoRealizada: `${dto.tipoRegistro} registrado pelo médico ${dto.medicoId}`,
      ipOrigem: this.extractIp(req),
      entidadeAfetada: 'ConsultaLaudo',
      entidadeId: (documento._id as object).toString(),
      usuarioResponsavel: dto.medicoId,
    });

    return documento;
  }

  async findByAtendimentoId(
    atendimentoId: string,
  ): Promise<ConsultaLaudoDocument[]> {
    return this.consultasLaudosRepository.findByAtendimentoId(atendimentoId);
  }

  async findByMedicoId(medicoId: string): Promise<ConsultaLaudoDocument[]> {
    return this.consultasLaudosRepository.findByMedicoId(medicoId);
  }

  async findByPacienteId(pacienteId: string): Promise<ConsultaLaudoDocument[]> {
    return this.consultasLaudosRepository.findByPacienteId(pacienteId);
  }

  async findAll(): Promise<ConsultaLaudoDocument[]> {
    return this.consultasLaudosRepository.findAll();
  }
}
