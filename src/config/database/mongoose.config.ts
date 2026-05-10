import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModuleAsyncOptions } from '@nestjs/mongoose';

/**
 * Configuração assíncrona do Mongoose para MongoDB
 * Utiliza variáveis de ambiente via ConfigService
 */
export const mongooseConfig: MongooseModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const host = configService.get<string>('MONGO_HOST', 'localhost');
    const port = configService.get<number>('MONGO_PORT', 27017);
    const username = configService.get<string>('MONGO_INITDB_ROOT_USERNAME', 'root');
    const password = configService.get<string>('MONGO_INITDB_ROOT_PASSWORD', 'rootpassword');
    const database = configService.get<string>('MONGO_DB', 'pep_nosql');

    // URI de conexão com autenticação
    const uri = `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}?authSource=admin`;

    const isDev = configService.get<string>('NODE_ENV') === 'development';

    return {
      uri,
      // Configurações recomendadas para produção
      retryWrites: true,
      w: 'majority',
      // Loga operações do Mongoose no terminal (apenas em development)
      // Mostra: find, findOne, save, etc — evidência visual do banco NoSQL em uso
      connectionFactory: (connection: any) => {
        if (isDev) {
          connection.set('debug', (collectionName: string, method: string, query: unknown) => {
            const logger = new (require('@nestjs/common').Logger)('MongoDB');
            logger.debug(`${collectionName}.${method}(${JSON.stringify(query)})`);
          });
        }
        return connection;
      },
    };
  },
};
