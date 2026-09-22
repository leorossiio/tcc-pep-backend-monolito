import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ConsultaLaudo,
  ConsultaLaudoDocument,
} from '../schemas/consulta-laudo.schema';
import { CreateConsultaLaudoDto } from '../dto/create-consulta-laudo.dto';

@Injectable()
export class ConsultasLaudosRepository {
  constructor(
    @InjectModel(ConsultaLaudo.name)
    private readonly model: Model<ConsultaLaudoDocument>,
  ) {}

  async create(
    dto: CreateConsultaLaudoDto & { hashIntegridade: string },
  ): Promise<ConsultaLaudoDocument> {
    const doc = new this.model(dto);
    return doc.save();
  }

  async findByAtendimentoId(
    atendimentoId: string,
  ): Promise<ConsultaLaudoDocument[]> {
    return this.model.find({ atendimentoId }).exec();
  }

  async findByMedicoId(medicoId: string): Promise<ConsultaLaudoDocument[]> {
    return this.model.find({ medicoId }).exec();
  }

  async findByAtendimentoIds(
    atendimentoIds: string[],
  ): Promise<ConsultaLaudoDocument[]> {
    if (atendimentoIds.length === 0) return [];
    return this.model.find({ atendimentoId: { $in: atendimentoIds } }).exec();
  }

  async findByHistoricoId(
    historicoId: string,
  ): Promise<ConsultaLaudoDocument[]> {
    return this.model.find({ historicoId }).exec();
  }

  async findAll(): Promise<ConsultaLaudoDocument[]> {
    return this.model.find().exec();
  }

  async removeByAtendimentoId(atendimentoId: string): Promise<void> {
    await this.model.deleteMany({ atendimentoId }).exec();
  }

  async removeByAtendimentoIds(atendimentoIds: string[]): Promise<void> {
    if (atendimentoIds.length === 0) return;
    await this.model
      .deleteMany({ atendimentoId: { $in: atendimentoIds } })
      .exec();
  }
}
