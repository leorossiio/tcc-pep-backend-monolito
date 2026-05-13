import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { LogsAuditoriaService } from '../services/logs-auditoria.service';
import { CreateLogAuditoriaDto } from '../dto/create-log-auditoria.dto';
import { UpdateLogAuditoriaDto } from '../dto/update-log-auditoria.dto';

@ApiTags('Logs de Auditoria')
@Controller('logs-auditoria')
export class LogsAuditoriaController {
  constructor(private readonly logsAuditoriaService: LogsAuditoriaService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar novo log de auditoria' })
  @ApiResponse({ status: 201, description: 'Log criado com sucesso' })
  create(@Body() dto: CreateLogAuditoriaDto) {
    return this.logsAuditoriaService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os logs de auditoria' })
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
  @ApiOperation({ summary: 'Listar logs de auditoria por atendimento' })
  @ApiParam({ name: 'atendimentoId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Logs do atendimento' })
  findByAtendimento(@Param('atendimentoId', ParseUUIDPipe) atendimentoId: string) {
    return this.logsAuditoriaService.findByAtendimento(atendimentoId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar log de auditoria' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Log atualizado' })
  @ApiResponse({ status: 404, description: 'Log não encontrado' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLogAuditoriaDto) {
    return this.logsAuditoriaService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover log de auditoria' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Log removido' })
  @ApiResponse({ status: 404, description: 'Log não encontrado' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.logsAuditoriaService.remove(id);
  }
}