import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Request } from 'express'; // <-- Importação adicionada
import { MedicosRepository } from '../repositories/medicos.repository';
import { AtendimentosService } from '../../atendimentos/services/atendimentos.service';
import { ConsultasLaudosService } from '../../consultas-laudos/services/consultas-laudos.service';
import { CreateMedicoDto } from '../dto/create-medico.dto';
import { UpdateMedicoDto } from '../dto/update-medico.dto';
import { Medico } from '../entities/medico.entity';
import { LogsAuditoriaService } from '../../logs-auditoria/services/logs-auditoria.service';

@Injectable()
export class MedicosService {
  constructor(
    private readonly medicosRepository: MedicosRepository,
    private readonly atendimentosService: AtendimentosService,
    private readonly consultasLaudosService: ConsultasLaudosService,
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

  async create(dto: CreateMedicoDto, req?: Request): Promise<Medico> {
    const existing = await this.medicosRepository.findByCrm(dto.crm);
    if (existing) {
      throw new ConflictException('Médico com este CRM já cadastrado');
    }

    const medico = new Medico();
    medico.nomeCompleto = dto.nomeCompleto;
    medico.crm = dto.crm;
    medico.especialidade = dto.especialidade;
    medico.ativo = dto.ativo ?? true;

    const saved = await this.medicosRepository.save(medico);

    this.logsAuditoriaService.registrar({
      atendimentoId: null,
      acaoRealizada: 'Médico cadastrado no sistema',
      ipOrigem: this.extractIp(req),
      entidadeAfetada: 'Medico',
      entidadeId: saved.id,
      usuarioResponsavel: 'sistema',
    });

    return saved;
  }

  findAll(): Promise<Medico[]> {
    return this.medicosRepository.findAll();
  }

  findAtivos(): Promise<Medico[]> {
    return this.medicosRepository.findAtivos();
  }

  async findOne(id: string): Promise<Medico> {
    const medico = await this.medicosRepository.findOne(id);
    if (!medico) {
      throw new NotFoundException(`Médico #${id} não encontrado`);
    }
    return medico;
  }

  async update(id: string, dto: UpdateMedicoDto, req?: Request): Promise<Medico> {
    const medico = await this.findOne(id);

    if (dto.crm && dto.crm !== medico.crm) {
      const crmEmUso = await this.medicosRepository.findByCrm(dto.crm);
      if (crmEmUso) {
        throw new ConflictException('Este CRM já está em uso por outro médico');
      }
      medico.crm = dto.crm;
    }

    if (dto.nomeCompleto) medico.nomeCompleto = dto.nomeCompleto;
    if (dto.especialidade) medico.especialidade = dto.especialidade;
    if (dto.ativo !== undefined) medico.ativo = dto.ativo;

    const saved = await this.medicosRepository.save(medico);

    const campos = Object.keys(dto).join(', ');
    this.logsAuditoriaService.registrar({
      atendimentoId: null,
      acaoRealizada: `Dados do médico atualizados — campos: ${campos}`,
      ipOrigem: this.extractIp(req),
      entidadeAfetada: 'Medico',
      entidadeId: id,
      usuarioResponsavel: 'sistema',
    });

    return saved;
  }

  async remove(id: string, req?: Request): Promise<void> {
    await this.findOne(id);
    await this.medicosRepository.remove(id);

    this.logsAuditoriaService.registrar({
      atendimentoId: null,
      acaoRealizada: 'Médico removido do sistema',
      ipOrigem: this.extractIp(req),
      entidadeAfetada: 'Medico',
      entidadeId: id,
      usuarioResponsavel: 'sistema',
    });
  }

  async getAtendimentos(id: string) {
    const medico = await this.findOne(id);
    const atendimentos = await this.atendimentosService.findComLaudosByMedicoId(id);
    return { medico, atendimentos };
  }

  async getLaudos(id: string) {
    const medico = await this.findOne(id);
    const laudos = await this.consultasLaudosService.findByMedicoId(id);
    const atendimentoIds = [...new Set(laudos.map((l) => l.atendimentoId))];
    const atendimentos = await this.atendimentosService.findByIds(atendimentoIds);
    return { medico, laudos, atendimentos };
  }
}