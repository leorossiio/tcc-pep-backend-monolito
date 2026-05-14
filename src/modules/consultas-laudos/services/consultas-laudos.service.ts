import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConsultasLaudosRepository } from '../repositories/consultas-laudos.repository';
import { CreateConsultaLaudoDto } from '../dto/create-consulta-laudo.dto';
import { ConsultaLaudoDocument } from '../schemas/consulta-laudo.schema';

@Injectable()
export class ConsultasLaudosService {
  constructor(
    private readonly consultasLaudosRepository: ConsultasLaudosRepository,
  ) {}

  async create(dto: CreateConsultaLaudoDto): Promise<ConsultaLaudoDocument> {
    try {
      return await this.consultasLaudosRepository.create(dto);
    } catch (error) {
      throw new InternalServerErrorException(
        'Falha ao persistir consulta/laudo no MongoDB',
      );
    }
  }

  async findByAtendimentoId(
    atendimentoId: string,
  ): Promise<ConsultaLaudoDocument[]> {
    return this.consultasLaudosRepository.findByAtendimentoId(atendimentoId);
  }

  async findAll(): Promise<ConsultaLaudoDocument[]> {
    return this.consultasLaudosRepository.findAll();
  }
}
