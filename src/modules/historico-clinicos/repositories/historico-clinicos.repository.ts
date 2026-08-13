import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  HistoricoClinico,
  HistoricoClinicoDocument,
  Alergia,
} from '../schemas/historico-clinico.schema';
import { CreateHistoricoClinicoDto } from '../dto/create-historico-clinico.dto';

@Injectable()
export class HistoricoClinicosRepository {
  constructor(
    @InjectModel(HistoricoClinico.name)
    private readonly model: Model<HistoricoClinicoDocument>,
  ) {}

  async create(
    dto: CreateHistoricoClinicoDto & { hashIntegridade: string },
  ): Promise<HistoricoClinicoDocument> {
    const doc = new this.model(dto);
    return doc.save();
  }

  async upsertByPacienteId(
    dto: CreateHistoricoClinicoDto & { hashIntegridade: string },
  ): Promise<HistoricoClinicoDocument> {
    return this.model
      .findOneAndUpdate(
        { pacienteId: dto.pacienteId },
        { $setOnInsert: dto },
        { upsert: true, returnDocument: 'after' },
      )
      .exec();
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

  /**
   * Adiciona novas alergias ao histórico existente do paciente (upsert incremental).
   * Chamado automaticamente quando uma consulta identifica novas alergias.
   */
  async adicionarAlergias(
    pacienteId: string,
    novasAlergias: Alergia[],
  ): Promise<HistoricoClinicoDocument | null> {
    return this.model
      .findOneAndUpdate(
        { pacienteId },
        { $push: { alergiasConhecidas: { $each: novasAlergias } } },
        { new: true },
      )
      .exec();
  }
}
