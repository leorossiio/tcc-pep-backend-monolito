import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('pacientes_pg')
export class Paciente {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'nome_completo', type: 'varchar' })
  nomeCompleto!: string;

  @Column({ type: 'varchar' })
  sexo!: string;

  @Column({ name: 'cpf_hash', type: 'varchar' })
  cpfHash!: string;

  @Column({ name: 'data_nascimento', type: 'date' })
  dataNascimento!: Date;

  @Column({ name: 'telefone_contato', type: 'varchar', nullable: true })
  telefoneContato!: string | null;

  @Column({ name: 'tipagem_sanguinea', type: 'varchar', nullable: true })
  tipagemSanguinea!: string | null;

  @Column({ name: 'consentimento_lgpd', type: 'boolean' })
  consentimentoLgpd!: boolean;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamp' })
  criadoEm!: Date;

}