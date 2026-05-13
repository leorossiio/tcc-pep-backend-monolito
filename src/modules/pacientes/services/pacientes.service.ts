import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PacientesRepository } from '../repositories/pacientes.repository';
import { CreatePacienteDto } from '../dto/create-paciente.dto';
import { UpdatePacienteDto } from '../dto/update-paciente.dto';
import { Paciente } from '../entities/paciente.entity';

@Injectable()
export class PacientesService {
  constructor(private readonly pacientesRepository: PacientesRepository) {}

  private hashCpf(cpf: string): string {
    return createHash('sha256').update(cpf).digest('hex');
  }

  async create(dto: CreatePacienteDto): Promise<Paciente> {
    const cpfHash = this.hashCpf(dto.cpf);

    const existing = await this.pacientesRepository.findByCpfHash(cpfHash);
    if (existing) {
      throw new ConflictException('Paciente com este CPF já cadastrado');
    }

    const paciente = new Paciente();
    paciente.nomeCompleto = dto.nomeCompleto;
    paciente.sexo = dto.sexo;
    paciente.cpfHash = cpfHash;
    paciente.dataNascimento = new Date(dto.dataNascimento);
    paciente.telefoneContato = dto.telefoneContato ?? null;
    paciente.tipagemSanguinea = dto.tipagemSanguinea ?? null;
    paciente.consentimentoLgpd = dto.consentimentoLgpd;

    return this.pacientesRepository.save(paciente);
  }

  findAll(): Promise<Paciente[]> {
    return this.pacientesRepository.findAll();
  }

  async findOne(id: string): Promise<Paciente> {
    const paciente = await this.pacientesRepository.findOne(id);
    if (!paciente) {
      throw new NotFoundException(`Paciente #${id} não encontrado`);
    }
    return paciente;
  }

  async update(id: string, dto: UpdatePacienteDto): Promise<Paciente> {
    const paciente = await this.findOne(id);

    if (dto.cpf) paciente.cpfHash = this.hashCpf(dto.cpf);
    if (dto.nomeCompleto) paciente.nomeCompleto = dto.nomeCompleto;
    if (dto.sexo) paciente.sexo = dto.sexo;
    if (dto.dataNascimento) paciente.dataNascimento = new Date(dto.dataNascimento);
    if (dto.telefoneContato !== undefined) paciente.telefoneContato = dto.telefoneContato ?? null;
    if (dto.tipagemSanguinea !== undefined) paciente.tipagemSanguinea = dto.tipagemSanguinea ?? null;
    if (dto.consentimentoLgpd !== undefined) paciente.consentimentoLgpd = dto.consentimentoLgpd;

    return this.pacientesRepository.save(paciente);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.pacientesRepository.remove(id);
  }
}

