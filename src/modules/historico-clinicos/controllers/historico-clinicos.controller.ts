import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { HistoricoClinicosService } from '../services/historico-clinicos.service';
import { CreateHistoricoClinicoDto } from '../dto/create-historico-clinico.dto';

@ApiTags('Histórico Clínico')
@Controller('historico-clinicos')
export class HistoricoClinicosController {
  constructor(private readonly historicoClinicosService: HistoricoClinicosService) {}

  @Post()
  @ApiOperation({ summary: 'Cria histórico clínico do paciente (MongoDB)' })
  create(@Body() dto: CreateHistoricoClinicoDto) {
    return this.historicoClinicosService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista todos os históricos clínicos (MongoDB)' })
  findAll() {
    return this.historicoClinicosService.findAll();
  }

  @Get('paciente/:pacienteId')
  @ApiOperation({ summary: 'Busca histórico clínico pelo UUID do paciente (MongoDB)' })
  @ApiParam({ name: 'pacienteId', description: 'UUID do paciente no PostgreSQL' })
  findByPacienteId(@Param('pacienteId') pacienteId: string) {
    return this.historicoClinicosService.findByPacienteId(pacienteId);
  }
}
