import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Medico } from '../entities/medico.entity';

@Injectable()
export class MedicosRepository {
  constructor(
    @InjectRepository(Medico)
    private readonly repo: Repository<Medico>,
  ) {}

  findAll(): Promise<Medico[]> {
    return this.repo.find();
  }

  findAtivos(): Promise<Medico[]> {
    return this.repo.findBy({ ativo: true });
  }

  findOne(id: string): Promise<Medico | null> {
    return this.repo.findOneBy({ id });
  }

  findByCrm(crm: string): Promise<Medico | null> {
    return this.repo.findOneBy({ crm });
  }

  save(medico: Medico): Promise<Medico> {
    return this.repo.save(medico);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
