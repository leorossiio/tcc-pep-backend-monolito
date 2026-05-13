import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Atendimento } from '../../atendimentos/entities/atendimento.entity';

@Entity('logs_auditoria_pg')
export class LogAuditoria {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'atendimento_id', type: 'uuid' })
  atendimentoId!: string;

  @Column({ name: 'acao_realizada', type: 'varchar' })
  acaoRealizada!: string;

  @CreateDateColumn({ name: 'data_hora', type: 'timestamp' })
  dataHora!: Date;

  @Column({ name: 'ip_origem', type: 'varchar', nullable: true })
  ipOrigem!: string | null;

  // Relação
  @ManyToOne(() => Atendimento, { eager: false })
  @JoinColumn({ name: 'atendimento_id' })
  atendimento!: Atendimento;
}