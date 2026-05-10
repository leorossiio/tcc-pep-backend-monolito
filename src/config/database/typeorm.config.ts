import { join } from 'path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';

/**
 * Configuração assíncrona do TypeORM para PostgreSQL
 * Utiliza variáveis de ambiente via ConfigService
 */
export const typeOrmConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    type: 'postgres' as const,
    host: configService.get<string>('POSTGRES_HOST', 'localhost'),
    port: configService.get<number>('POSTGRES_PORT', 5432),
    username: configService.get<string>('POSTGRES_USER', 'root'),
    password: configService.get<string>('POSTGRES_PASSWORD', 'rootpassword'),
    database: configService.get<string>('POSTGRES_DB', 'pep_relacional'),
    autoLoadEntities: true,
    // synchronize: true cria/atualiza tabelas automaticamente a partir das entities
    // Adequado para desenvolvimento; trocar por false + migrations em produção
    synchronize: true,
    migrationsRun: false,
    migrations: [join(__dirname, '../../migrations/**/*{.ts,.js}')],
    // Logging de queries SQL (útil para debug e benchmarks)
    logging: configService.get<string>('NODE_ENV') === 'development',
  }),
};
