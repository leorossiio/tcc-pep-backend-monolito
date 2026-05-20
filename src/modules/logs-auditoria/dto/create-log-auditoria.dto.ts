/**
 * DTO interno de auditoria — usado EXCLUSIVAMENTE pelas services do sistema.
 * Não é exposto via API REST (nenhum endpoint de POST aceita este DTO diretamente).
 */
export class CreateLogAuditoriaDto {
  atendimentoId?: string | null;
  acaoRealizada!: string;
  ipOrigem?: string | null;
  entidadeAfetada!: string;
  entidadeId?: string | null;
  usuarioResponsavel?: string | null;
}
