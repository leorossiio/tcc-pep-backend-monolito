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
import { MedicosService } from '../services/medicos.service';
import { CreateMedicoDto } from '../dto/create-medico.dto';
import { UpdateMedicoDto } from '../dto/update-medico.dto';

@ApiTags('Médicos')
@Controller('medicos')
export class MedicosController {
  constructor(private readonly medicosService: MedicosService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastrar novo médico' })
  @ApiResponse({ status: 201, description: 'Médico criado com sucesso' })
  @ApiResponse({ status: 409, description: 'CRM já cadastrado' })
  create(@Body() dto: CreateMedicoDto) {
    return this.medicosService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os médicos' })
  @ApiResponse({ status: 200, description: 'Lista de médicos' })
  findAll() {
    return this.medicosService.findAll();
  }

  @Get('ativos')
  @ApiOperation({ summary: 'Listar apenas médicos ativos' })
  @ApiResponse({ status: 200, description: 'Lista de médicos ativos' })
  findAtivos() {
    return this.medicosService.findAtivos();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar médico por ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Médico encontrado' })
  @ApiResponse({ status: 404, description: 'Médico não encontrado' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.medicosService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar médico' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Médico atualizado' })
  @ApiResponse({ status: 404, description: 'Médico não encontrado' })
  @ApiResponse({ status: 409, description: 'CRM já em uso por outro médico' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMedicoDto) {
    return this.medicosService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover médico' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Médico removido' })
  @ApiResponse({ status: 404, description: 'Médico não encontrado' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.medicosService.remove(id);
  }
}