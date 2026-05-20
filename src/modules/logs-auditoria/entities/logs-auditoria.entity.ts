import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Atendimento } from '../../atendimentos/entities/atendimento.entity';

/**
 * Entidade de auditoria — gerada EXCLUSIVAMENTE de forma automática pelo sistema.
 * Nunca deve ser criada por ação direta do usuário via API.
 */
@Entity('logs_auditoria_pg')
export class LogAuditoria {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * ID do atendimento vinculado ao log (nullable — ações como criação de paciente/médico
   * ainda não possuem atendimento associado).
   */
  @Column({ name: 'atendimento_id', type: 'uuid', nullable: true })
  atendimentoId!: string | null;

  /** Ação realizada — texto descritivo gerado pelo sistema. */
  @Column({ name: 'acao_realizada', type: 'varchar' })
  acaoRealizada!: string;

  /** Data/hora gerada automaticamente no momento da persistência. */
  @CreateDateColumn({ name: 'data_hora', type: 'timestamp' })
  dataHora!: Date;

  /** IP de origem extraído do request quando disponível. */
  @Column({ name: 'ip_origem', type: 'varchar', nullable: true })
  ipOrigem!: string | null;

  /** Nome da entidade afetada (ex: 'Atendimento', 'ConsultaLaudo', 'Paciente'). */
  @Column({ name: 'entidade_afetada', type: 'varchar' })
  entidadeAfetada!: string;

  /** ID da entidade afetada (UUID do registro criado/alterado/removido). */
  @Column({ name: 'entidade_id', type: 'varchar', nullable: true })
  entidadeId!: string | null;

  /** Identificador do responsável pela ação (medicoId, userId, 'sistema'). */
  @Column({ name: 'usuario_responsavel', type: 'varchar', nullable: true })
  usuarioResponsavel!: string | null;

  @ManyToOne(() => Atendimento, { eager: false, nullable: true })
  @JoinColumn({ name: 'atendimento_id' })
  atendimento!: Atendimento | null;
}
