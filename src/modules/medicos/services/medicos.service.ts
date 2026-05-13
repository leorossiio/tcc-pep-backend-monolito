import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { MedicosRepository } from '../repositories/medicos.repository';
import { CreateMedicoDto } from '../dto/create-medico.dto';
import { UpdateMedicoDto } from '../dto/update-medico.dto';
import { Medico } from '../entities/medico.entity';

@Injectable()
export class MedicosService {
  constructor(private readonly medicosRepository: MedicosRepository) {}

  async create(dto: CreateMedicoDto): Promise<Medico> {
    const existing = await this.medicosRepository.findByCrm(dto.crm);
    if (existing) {
      throw new ConflictException('Médico com este CRM já cadastrado');
    }

    const medico = new Medico();
    medico.nomeCompleto = dto.nomeCompleto;
    medico.crm = dto.crm;
    medico.especialidade = dto.especialidade;
    medico.ativo = dto.ativo ?? true;

    return this.medicosRepository.save(medico);
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

  async update(id: string, dto: UpdateMedicoDto): Promise<Medico> {
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

    return this.medicosRepository.save(medico);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.medicosRepository.remove(id);
  }
}
