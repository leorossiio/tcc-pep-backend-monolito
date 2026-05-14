import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Atendimento } from '../entities/atendimento.entity';
import { CreateAtendimentoDto } from '../dto/create-atendimento.dto';
import { UpdateAtendimentoDto } from '../dto/update-atendimento.dto';

@Injectable()
export class AtendimentosRepository {
  constructor(
    @InjectRepository(Atendimento)
    private readonly repo: Repository<Atendimento>,
  ) {}

  async create(dto: CreateAtendimentoDto): Promise<Atendimento> {
    const entidade = this.repo.create({
      pacienteId: dto.pacienteId,
      medicoTriagemId: dto.medicoTriagemId,
      dataHoraEntrada: new Date(dto.dataHoraEntrada),
      queixaPrincipal: dto.queixaPrincipal,
      pressaoArterial: dto.pressaoArterial,
      frequenciaCardiaca: dto.frequenciaCardiaca,
      saturacaoOxigenio: dto.saturacaoOxigenio,
      temperaturaCorporal: dto.temperaturaCorporal,
      frequenciaRespiratoria: dto.frequenciaRespiratoria,
      classificacaoRisco: dto.classificacaoRisco,
    });
    return this.repo.save(entidade);
  }

  async findAll(): Promise<Atendimento[]> {
    return this.repo.find();
  }

  async findOneById(id: string): Promise<Atendimento | null> {
    return this.repo.findOne({ where: { id } });
  }

  async update(id: string, dto: UpdateAtendimentoDto): Promise<Atendimento | null> {
    await this.repo.update(id, {
      ...(dto.pacienteId && { pacienteId: dto.pacienteId }),
      ...(dto.medicoTriagemId && { medicoTriagemId: dto.medicoTriagemId }),
      ...(dto.dataHoraEntrada && { dataHoraEntrada: new Date(dto.dataHoraEntrada) }),
      ...(dto.queixaPrincipal && { queixaPrincipal: dto.queixaPrincipal }),
      ...(dto.pressaoArterial !== undefined && { pressaoArterial: dto.pressaoArterial }),
      ...(dto.frequenciaCardiaca !== undefined && { frequenciaCardiaca: dto.frequenciaCardiaca }),
      ...(dto.saturacaoOxigenio !== undefined && { saturacaoOxigenio: dto.saturacaoOxigenio }),
      ...(dto.temperaturaCorporal !== undefined && { temperaturaCorporal: dto.temperaturaCorporal }),
      ...(dto.frequenciaRespiratoria !== undefined && { frequenciaRespiratoria: dto.frequenciaRespiratoria }),
      ...(dto.classificacaoRisco && { classificacaoRisco: dto.classificacaoRisco }),
    });
    return this.findOneById(id);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async findByPacienteId(pacienteId: string): Promise<Atendimento[]> {
    return this.repo.find({ where: { pacienteId } });
  }

  async findByMedicoTriagemId(medicoTriagemId: string): Promise<Atendimento[]> {
    return this.repo.find({ where: { medicoTriagemId } });
  }

  async findByIds(ids: string[]): Promise<Atendimento[]> {
    if (ids.length === 0) return [];
    return this.repo
      .createQueryBuilder('a')
      .where('a.id IN (:...ids)', { ids })
      .getMany();
  }
}
