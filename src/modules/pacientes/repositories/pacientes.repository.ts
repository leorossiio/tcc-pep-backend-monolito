import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paciente } from '../entities/paciente.entity';

@Injectable()
export class PacientesRepository {
  constructor(
    @InjectRepository(Paciente)
    private readonly repo: Repository<Paciente>,
  ) {}

  findAll(): Promise<Paciente[]> {
    return this.repo.find();
  }

  findOne(id: string): Promise<Paciente | null> {
    return this.repo.findOneBy({ id });
  }

  findByCpfHash(cpfHash: string): Promise<Paciente | null> {
    return this.repo.findOneBy({ cpfHash });
  }

  save(paciente: Paciente): Promise<Paciente> {
    return this.repo.save(paciente);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async findOneById(id: string): Promise<Paciente | null> {
    return this.repo.findOneBy({ id });
  }

}
