import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HistoricoClinicosRepository } from '../repositories/historico-clinicos.repository';
import { CreateHistoricoClinicoDto } from '../dto/create-historico-clinico.dto';
import { HistoricoClinicoDocument } from '../schemas/historico-clinico.schema';

@Injectable()
export class HistoricoClinicosService {
  constructor(
    private readonly historicoClinicosRepository: HistoricoClinicosRepository,
  ) {}

  async create(dto: CreateHistoricoClinicoDto): Promise<HistoricoClinicoDocument> {
    try {
      return await this.historicoClinicosRepository.create(dto);
    } catch (error) {
      throw new InternalServerErrorException(
        'Falha ao criar histórico clínico no MongoDB',
      );
    }
  }

  async findByPacienteId(
    pacienteId: string,
  ): Promise<HistoricoClinicoDocument | null> {
    return this.historicoClinicosRepository.findByPacienteId(pacienteId);
  }

  async findAll(): Promise<HistoricoClinicoDocument[]> {
    return this.historicoClinicosRepository.findAll();
  }
}
