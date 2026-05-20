import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { ConsultasLaudosService } from '../services/consultas-laudos.service';
import { CreateConsultaLaudoDto } from '../dto/create-consulta-laudo.dto';

@ApiTags('Consultas e Laudos')
@Controller('consultas-laudos')
export class ConsultasLaudosController {
  constructor(
    private readonly consultasLaudosService: ConsultasLaudosService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Médico registra consulta ou laudo (MongoDB)',
    description:
      'Persiste no MongoDB, propaga novas alergias ao histórico clínico e gera log de auditoria automaticamente.',
  })
  @ApiResponse({ status: 201, description: 'Consulta/laudo criado com sucesso' })
  create(@Body() dto: CreateConsultaLaudoDto, @Req() req: any) {
    return this.consultasLaudosService.create(dto, req);
  }

  @Get()
  @ApiOperation({ summary: 'Lista todos os laudos/consultas (MongoDB)' })
  findAll() {
    return this.consultasLaudosService.findAll();
  }

  @Get('atendimento/:atendimentoId')
  @ApiOperation({ summary: 'Busca laudos pelo UUID do atendimento (MongoDB)' })
  @ApiParam({
    name: 'atendimentoId',
    description: 'UUID do atendimento no PostgreSQL',
  })
  findByAtendimentoId(@Param('atendimentoId') atendimentoId: string) {
    return this.consultasLaudosService.findByAtendimentoId(atendimentoId);
  }
}
