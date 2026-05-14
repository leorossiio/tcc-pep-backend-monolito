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
import { PacientesService } from '../services/pacientes.service';
import { CreatePacienteDto } from '../dto/create-paciente.dto';
import { UpdatePacienteDto } from '../dto/update-paciente.dto';

@ApiTags('Pacientes')
@Controller('pacientes')
export class PacientesController {
  constructor(private readonly pacientesService: PacientesService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastrar novo paciente' })
  @ApiResponse({ status: 201, description: 'Paciente criado com sucesso' })
  @ApiResponse({ status: 409, description: 'CPF já cadastrado' })
  create(@Body() dto: CreatePacienteDto) {
    return this.pacientesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os pacientes' })
  @ApiResponse({ status: 200, description: 'Lista de pacientes' })
  findAll() {
    return this.pacientesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar paciente por ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Paciente encontrado' })
  @ApiResponse({ status: 404, description: 'Paciente não encontrado' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.pacientesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar paciente' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Paciente atualizado' })
  @ApiResponse({ status: 404, description: 'Paciente não encontrado' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePacienteDto) {
    return this.pacientesService.update(id, dto);
  }

  @Get(':id/historico-completo')
  @ApiOperation({ summary: 'Busca visão 360 do paciente (PG + MDB join poliglota)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Paciente + histórico clínico + atendimentos com laudos' })
  @ApiResponse({ status: 404, description: 'Paciente não encontrado' })
  getHistoricoCompleto(@Param('id', ParseUUIDPipe) id: string) {
    return this.pacientesService.getHistoricoCompleto(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover paciente' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Paciente removido' })
  @ApiResponse({ status: 404, description: 'Paciente não encontrado' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.pacientesService.remove(id);
  }
}

