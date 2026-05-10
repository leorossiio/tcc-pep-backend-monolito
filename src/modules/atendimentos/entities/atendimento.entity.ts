import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Paciente } from '../../pacientes/entities/paciente.entity';
import { Medico } from '../../medicos/entities/medico.entity';
import { LogAuditoria } from '../../logs-auditoria/entities/logs-auditoria.entity';

export enum RiscoManchester {
  VERMELHO = 'VERMELHO',     // Imediato
  LARANJA = 'LARANJA',       // Muito urgente
  AMARELO = 'AMARELO',       // Urgente
  VERDE = 'VERDE',           // Pouco urgente
  AZUL = 'AZUL',             // Não urgente
}

@Entity('atendimentos_pg')
export class Atendimento {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId!: string;

  @Column({ name: 'medico_triagem_id', type: 'uuid' })
  medicoTriagemId!: string;

  @Column({ name: 'data_hora_entrada', type: 'timestamp' })
  dataHoraEntrada!: Date;

  @Column({ name: 'queixa_principal', type: 'varchar' })
  queixaPrincipal!: string;

  @Column({ name: 'pressao_arterial', type: 'varchar', nullable: true })
  pressaoArterial!: string;

  @Column({ name: 'frequencia_cardiaca', type: 'int', nullable: true })
  frequenciaCardiaca!: number;

  @Column({ name: 'saturacao_oxigenio', type: 'int', nullable: true })
  saturacaoOxigenio!: number;

  @Column({ name: 'temperatura_corporal', type: 'decimal', precision: 4, scale: 1, nullable: true })
  temperaturaCorporal!: number;

  @Column({ name: 'frequencia_respiratoria', type: 'int', nullable: true })
  frequenciaRespiratoria!: number;

  @Column({
    name: 'classificacao_risco',
    type: 'enum',
    enum: RiscoManchester,
  })
  classificacaoRisco!: RiscoManchester;

  // Relações
  @ManyToOne(() => Paciente, (paciente) => paciente.atendimentos, { eager: false })
  @JoinColumn({ name: 'paciente_id' })
  paciente!: Paciente;

  @ManyToOne(() => Medico, (medico) => medico.atendimentos, { eager: false })
  @JoinColumn({ name: 'medico_triagem_id' })
  medicoTriagem!: Medico;

  @OneToMany(() => LogAuditoria, (log) => log.atendimento)
  logsAuditoria!: LogAuditoria[];
}