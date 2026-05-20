import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { LogsAuditoriaService } from '../services/logs-auditoria.service';

/**
 * LogsAuditoriaController — SOMENTE LEITURA.
 *
 * Logs são gerados automaticamente pelas services do sistema.
 * Nenhum endpoint de escrita (POST / PATCH / DELETE) é exposto.
 */
@ApiTags('Logs de Auditoria')
@Controller('logs-auditoria')
export class LogsAuditoriaController {
  constructor(private readonly logsAuditoriaService: LogsAuditoriaService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos os logs de auditoria (gerados automaticamente)' })
  @ApiResponse({ status: 200, description: 'Lista de logs de auditoria' })
  findAll() {
    return this.logsAuditoriaService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar log de auditoria por ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Log encontrado' })
  @ApiResponse({ status: 404, description: 'Log não encontrado' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.logsAuditoriaService.findOne(id);
  }

  @Get('atendimento/:atendimentoId')
  @ApiOperation({ summary: 'Listar logs de auditoria de um atendimento' })
  @ApiParam({ name: 'atendimentoId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Logs do atendimento' })
  findByAtendimento(@Param('atendimentoId', ParseUUIDPipe) atendimentoId: string) {
    return this.logsAuditoriaService.findByAtendimento(atendimentoId);
  }

  @Get('entidade/:entidade/:entidadeId')
  @ApiOperation({ summary: 'Listar logs por entidade e ID (ex: ConsultaLaudo / uuid)' })
  @ApiParam({ name: 'entidade', type: 'string', example: 'ConsultaLaudo' })
  @ApiParam({ name: 'entidadeId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Logs da entidade' })
  findByEntidade(
    @Param('entidade') entidade: string,
    @Param('entidadeId') entidadeId: string,
  ) {
    return this.logsAuditoriaService.findByEntidade(entidade, entidadeId);
  }
}
