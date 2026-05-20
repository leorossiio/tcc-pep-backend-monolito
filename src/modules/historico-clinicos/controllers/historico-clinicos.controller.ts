import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { HistoricoClinicosService } from '../services/historico-clinicos.service';

/**
 * HistoricoClinicosController — SOMENTE LEITURA.
 *
 * O histórico clínico é criado e atualizado automaticamente pelo sistema:
 *   - criado na primeira triagem do paciente (AtendimentosService)
 *   - alergias atualizadas ao final de cada consulta (ConsultasLaudosService)
 *
 * Não existe endpoint de POST ou PATCH manual.
 */
@ApiTags('Histórico Clínico')
@Controller('historico-clinicos')
export class HistoricoClinicosController {
  constructor(
    private readonly historicoClinicosService: HistoricoClinicosService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista todos os históricos clínicos (MongoDB)' })
  findAll() {
    return this.historicoClinicosService.findAll();
  }

  @Get('paciente/:pacienteId')
  @ApiOperation({
    summary: 'Busca histórico clínico pelo UUID do paciente (MongoDB)',
  })
  @ApiParam({ name: 'pacienteId', description: 'UUID do paciente no PostgreSQL' })
  findByPacienteId(@Param('pacienteId') pacienteId: string) {
    return this.historicoClinicosService.findByPacienteId(pacienteId);
  }
}
