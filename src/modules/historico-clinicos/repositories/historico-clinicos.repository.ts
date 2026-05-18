import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  HistoricoClinico,
  HistoricoClinicoDocument,
} from '../schemas/historico-clinico.schema';
import { CreateHistoricoClinicoDto } from '../dto/create-historico-clinico.dto';

@Injectable()
export class HistoricoClinicosRepository {
  constructor(
    @InjectModel(HistoricoClinico.name)
    private readonly model: Model<HistoricoClinicoDocument>,
  ) {}

  async create(dto: CreateHistoricoClinicoDto & { hashIntegridade: string }): Promise<HistoricoClinicoDocument> {
    const doc = new this.model(dto);
    return doc.save();
  }

  async findByPacienteId(
    pacienteId: string,
  ): Promise<HistoricoClinicoDocument | null> {
    return this.model.findOne({ pacienteId }).exec();
  }

  async findAll(): Promise<HistoricoClinicoDocument[]> {
    return this.model.find().exec();
  }

  async removeByPacienteId(pacienteId: string): Promise<void> {
    await this.model.deleteOne({ pacienteId }).exec();
  }
}
