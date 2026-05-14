import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('medicos_pg')
export class Medico {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'nome_completo', type: 'varchar' })
  nomeCompleto!: string;

  @Column({ type: 'varchar' })
  crm!: string;

  @Column({ type: 'varchar' })
  especialidade!: string;

  @Column({ type: 'boolean' })
  ativo!: boolean;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamp' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamp' })
  atualizadoEm!: Date;

}