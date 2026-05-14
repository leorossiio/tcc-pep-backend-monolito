import { Controller, Get, Post, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { ConsultasLaudosService } from '../services/consultas-laudos.service';
import { CreateConsultaLaudoDto } from '../dto/create-consulta-laudo.dto';

@ApiTags('Consultas e Laudos')
@Controller('consultas-laudos')
export class ConsultasLaudosController {
  constructor(private readonly consultasLaudosService: ConsultasLaudosService) {}

  /**
   * Persiste um documento de consulta/laudo diretamente no MongoDB.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registra uma consulta ou laudo (MongoDB)' })
  @ApiResponse({ status: 201, description: 'Consulta/laudo criado com sucesso' })
  create(@Body() dto: CreateConsultaLaudoDto) {
    return this.consultasLaudosService.create(dto);
  }

  /**
   * Lista todos os documentos de consultas/laudos — leitura analítica pura no MongoDB.
   */
  @Get()
  @ApiOperation({ summary: 'Lista todos os laudos/consultas (MongoDB)' })
  findAll() {
    return this.consultasLaudosService.findAll();
  }

  /**
   * Busca todos os laudos de um atendimento pelo UUID.
   * Endpoint direto ao MongoDB — complementar ao join poliglota do GET /atendimentos/:id.
   */
  @Get('atendimento/:atendimentoId')
  @ApiOperation({ summary: 'Busca laudos pelo UUID do atendimento (MongoDB)' })
  @ApiParam({ name: 'atendimentoId', description: 'UUID do atendimento no PostgreSQL' })
  findByAtendimentoId(@Param('atendimentoId') atendimentoId: string) {
    return this.consultasLaudosService.findByAtendimentoId(atendimentoId);
  }
}
