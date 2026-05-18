import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { hashCpf, encryptNome, decryptNome } from '../../../common/utils/crypto.util';
import { PacientesRepository } from '../repositories/pacientes.repository';
import { AtendimentosService } from '../../atendimentos/services/atendimentos.service';
import { HistoricoClinicosService } from '../../historico-clinicos/services/historico-clinicos.service';
import { CreatePacienteDto } from '../dto/create-paciente.dto';
import { UpdatePacienteDto } from '../dto/update-paciente.dto';
import { Paciente } from '../entities/paciente.entity';

@Injectable()
export class PacientesService {
  constructor(
    private readonly pacientesRepository: PacientesRepository,
    private readonly atendimentosService: AtendimentosService,
    private readonly historicoClinicosService: HistoricoClinicosService,
  ) {}

  private decrypt(paciente: Paciente): Paciente {
    try {
      paciente.nomeCompleto = decryptNome(paciente.nomeCompleto);
    } catch {
      // valor já está em texto plano (dado anterior à criptografia) — retorna como está
    }
    return paciente;
  }

  async create(dto: CreatePacienteDto): Promise<Paciente> {
    const cpfHash = hashCpf(dto.cpf);

    const existing = await this.pacientesRepository.findByCpfHash(cpfHash);
    if (existing) {
      throw new ConflictException('Paciente com este CPF já cadastrado');
    }

    const paciente = new Paciente();
    paciente.nomeCompleto = encryptNome(dto.nomeCompleto);
    paciente.sexo = dto.sexo;
    paciente.cpfHash = cpfHash;
    paciente.dataNascimento = new Date(dto.dataNascimento);
    paciente.telefoneContato = dto.telefoneContato ?? null;
    paciente.tipagemSanguinea = dto.tipagemSanguinea ?? null;
    paciente.consentimentoLgpd = dto.consentimentoLgpd;

    const saved = await this.pacientesRepository.save(paciente);
    return this.decrypt(saved);
  }

  async findAll(): Promise<Paciente[]> {
    const pacientes = await this.pacientesRepository.findAll();
    return pacientes.map((p) => this.decrypt(p));
  }

  async findOne(id: string): Promise<Paciente> {
    const paciente = await this.pacientesRepository.findOne(id);
    if (!paciente) {
      throw new NotFoundException(`Paciente #${id} não encontrado`);
    }
    return this.decrypt(paciente);
  }

  async update(id: string, dto: UpdatePacienteDto): Promise<Paciente> {
    const paciente = await this.pacientesRepository.findOne(id);
    if (!paciente) {
      throw new NotFoundException(`Paciente #${id} não encontrado`);
    }

    if (dto.cpf) paciente.cpfHash = hashCpf(dto.cpf);
    if (dto.nomeCompleto) paciente.nomeCompleto = encryptNome(dto.nomeCompleto);
    if (dto.sexo) paciente.sexo = dto.sexo;
    if (dto.dataNascimento) paciente.dataNascimento = new Date(dto.dataNascimento);
    if (dto.telefoneContato !== undefined) paciente.telefoneContato = dto.telefoneContato ?? null;
    if (dto.tipagemSanguinea !== undefined) paciente.tipagemSanguinea = dto.tipagemSanguinea ?? null;
    if (dto.consentimentoLgpd !== undefined) paciente.consentimentoLgpd = dto.consentimentoLgpd;

    const saved = await this.pacientesRepository.save(paciente);
    return this.decrypt(saved);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.pacientesRepository.remove(id);
  }

  async getHistoricoCompleto(id: string) {
    const paciente = await this.findOne(id);

    const historicoClinico = await this.historicoClinicosService.findByPacienteId(id);

    const atendimentos = await this.atendimentosService.findByPacienteId(id);

    const atendimentosComLaudos = await Promise.all(
      atendimentos.map(async (a) => ({
        ...a,
        consultasLaudos: await this.atendimentosService.findOne(a.id).then((r) => r.consultasLaudos),
      }))
    );

    return {
      paciente,
      historicoClinico,
      atendimentos: atendimentosComLaudos,
    };
  }
}

