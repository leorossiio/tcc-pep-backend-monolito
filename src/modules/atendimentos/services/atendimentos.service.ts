import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AtendimentosRepository } from '../repositories/atendimentos.repository';
import { ConsultasLaudosService } from '../../consultas-laudos/services/consultas-laudos.service';
import { HistoricoClinicosService } from '../../historico-clinicos/services/historico-clinicos.service';
import { Atendimento } from '../entities/atendimento.entity';
import { CreateAtendimentoDto } from '../dto/create-atendimento.dto';
import { UpdateAtendimentoDto } from '../dto/update-atendimento.dto';

@Injectable()
export class AtendimentosService {
  constructor(
    private readonly atendimentosRepository: AtendimentosRepository,
    private readonly consultasLaudosService: ConsultasLaudosService,
    private readonly historicoClinicosService: HistoricoClinicosService,
  ) {}

  async create(dto: CreateAtendimentoDto) {
    let atendimentoSalvo;

    try {
      atendimentoSalvo = await this.atendimentosRepository.create(dto);
    } catch (error) {
      throw new InternalServerErrorException(
        'Falha ao persistir atendimento no PostgreSQL',
      );
    }

    const historico = await this.historicoClinicosService.findByPacienteId(dto.pacienteId);
    if (!historico) {
      throw new NotFoundException(
        `Histórico clínico não encontrado para o paciente "${dto.pacienteId}". Cadastre o histórico clínico antes de criar um atendimento.`,
      );
    }

    try {
      await this.consultasLaudosService.create({
        atendimentoId: atendimentoSalvo.id,
        historicoId: (historico._id as object).toString(),
        medicoId: dto.medicoTriagemId,
        dataRegistro: new Date(),
        tipoRegistro: 'TRIAGEM',
        descricaoClinica: dto.queixaPrincipal,
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'Falha ao persistir consulta/laudo no MongoDB',
      );
    }

    return { success: true, atendimentoId: atendimentoSalvo.id };
  }

  async findAll() {
    return this.atendimentosRepository.findAll();
  }

  async findByPacienteId(pacienteId: string): Promise<Atendimento[]> {
    return this.atendimentosRepository.findByPacienteId(pacienteId);
  }

  async findComLaudosByMedicoId(medicoId: string) {
    const atendimentos = await this.atendimentosRepository.findByMedicoTriagemId(medicoId);
    return Promise.all(
      atendimentos.map(async (a) => ({
        ...a,
        consultasLaudos: await this.consultasLaudosService.findByAtendimentoId(a.id),
      }))
    );
  }

  async findByIds(ids: string[]): Promise<Atendimento[]> {
    return this.atendimentosRepository.findByIds(ids);
  }

  async findOne(id: string) {
    const atendimento = await this.atendimentosRepository.findOneById(id);
    if (!atendimento) {
      throw new NotFoundException(`Atendimento com ID "${id}" não encontrado`);
    }

    const consultasLaudos =
      await this.consultasLaudosService.findByAtendimentoId(id);

    return {
      ...atendimento,
      consultasLaudos,
    };
  }

  async update(id: string, dto: UpdateAtendimentoDto) {
    const atendimento = await this.atendimentosRepository.findOneById(id);
    if (!atendimento) {
      throw new NotFoundException(`Atendimento com ID "${id}" não encontrado`);
    }
    return this.atendimentosRepository.update(id, dto);
  }

  async remove(id: string) {
    const atendimento = await this.atendimentosRepository.findOneById(id);
    if (!atendimento) {
      throw new NotFoundException(`Atendimento com ID "${id}" não encontrado`);
    }
    await this.atendimentosRepository.remove(id);
    return { success: true, removed: id };
  }
}

