import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { AtendimentosService } from '../services/atendimentos.service';
import { CreateAtendimentoDto } from '../dto/create-atendimento.dto';
import { UpdateAtendimentoDto } from '../dto/update-atendimento.dto';

@ApiTags('Atendimentos')
@Controller('atendimentos')
export class AtendimentosController {
  constructor(private readonly atendimentosService: AtendimentosService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cria um novo atendimento (dual-write Postgres + MongoDB)' })
  create(@Body() dto: CreateAtendimentoDto) {
    return this.atendimentosService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista todos os atendimentos (PostgreSQL)' })
  findAll() {
    return this.atendimentosService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca prontuário completo via join poliglota (Postgres + MongoDB)' })
  @ApiParam({ name: 'id', description: 'UUID do atendimento' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.atendimentosService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza parcialmente um atendimento (PostgreSQL)' })
  @ApiParam({ name: 'id', description: 'UUID do atendimento' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAtendimentoDto,
  ) {
    return this.atendimentosService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove um atendimento pelo UUID' })
  @ApiResponse({ status: 204, description: 'Atendimento removido com sucesso' })
  @ApiResponse({ status: 404, description: 'Atendimento não encontrado' })
  @ApiParam({ name: 'id', description: 'UUID do atendimento' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.atendimentosService.remove(id);
  }
}

