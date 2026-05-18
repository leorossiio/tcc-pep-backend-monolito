import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConsultasLaudosRepository } from '../repositories/consultas-laudos.repository';
import { CreateConsultaLaudoDto } from '../dto/create-consulta-laudo.dto';
import { ConsultaLaudoDocument } from '../schemas/consulta-laudo.schema';
import { hashDocument } from '../../../common/utils/crypto.util';

@Injectable()
export class ConsultasLaudosService {
  constructor(
    private readonly consultasLaudosRepository: ConsultasLaudosRepository,
  ) {}

  async create(dto: CreateConsultaLaudoDto): Promise<ConsultaLaudoDocument> {
    try {
      const hashIntegridade = hashDocument(dto as unknown as Record<string, unknown>);
      return await this.consultasLaudosRepository.create({ ...dto, hashIntegridade });
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

  async findByMedicoId(medicoId: string): Promise<ConsultaLaudoDocument[]> {
    return this.consultasLaudosRepository.findByMedicoId(medicoId);
  }

  async findAll(): Promise<ConsultaLaudoDocument[]> {
    return this.consultasLaudosRepository.findAll();
  }
}
