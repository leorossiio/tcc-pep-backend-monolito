import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HistoricoClinicosRepository } from '../repositories/historico-clinicos.repository';
import { CreateHistoricoClinicoDto } from '../dto/create-historico-clinico.dto';
import { HistoricoClinicoDocument, Alergia } from '../schemas/historico-clinico.schema';
import { hashDocument } from '../../../common/utils/crypto.util';

/**
 * HistoricoClinicosService
 *
 * O histórico clínico é criado AUTOMATICAMENTE na primeira triagem do paciente.
 * Não existe endpoint de POST manual para o usuário.
 *
 * Após a criação, o histórico é alimentado de forma incremental:
 *   - novas alergias identificadas em consultas
 *   - (futuro) atualização de comorbidades, LGPD, etc.
 */
@Injectable()
export class HistoricoClinicosService {
  constructor(
    private readonly historicoClinicosRepository: HistoricoClinicosRepository,
  ) {}

  /**
   * Cria o histórico clínico do paciente.
   * Chamado automaticamente por AtendimentosService na primeira triagem.
   * Idempotente: se já existir histórico para o paciente, retorna o existente.
   */
  async criarOuObter(
    dto: CreateHistoricoClinicoDto,
  ): Promise<HistoricoClinicoDocument> {
    const existente = await this.historicoClinicosRepository.findByPacienteId(
      dto.pacienteId,
    );
    if (existente) return existente;

    try {
      const hashIntegridade = hashDocument(
        dto as unknown as Record<string, unknown>,
      );
      return await this.historicoClinicosRepository.create({
        ...dto,
        hashIntegridade,
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'Falha ao criar histórico clínico no MongoDB',
      );
    }
  }

  /**
   * Atualiza o histórico clínico adicionando novas alergias identificadas em consulta.
   * Chamado automaticamente por ConsultasLaudosService.
   */
  async adicionarAlergias(
    pacienteId: string,
    novasAlergias: Alergia[],
  ): Promise<void> {
    if (!novasAlergias || novasAlergias.length === 0) return;
    try {
      await this.historicoClinicosRepository.adicionarAlergias(
        pacienteId,
        novasAlergias,
      );
    } catch (err) {
      console.error('[HistoricoClinico] Falha ao adicionar alergias:', err);
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
