import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModuleAsyncOptions } from '@nestjs/mongoose';

export const mongooseConfig: MongooseModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const host = configService.get<string>('MONGO_HOST', 'localhost');
    const port = configService.get<number>('MONGO_PORT', 27017);
    const username = configService.get<string>('MONGO_INITDB_ROOT_USERNAME', 'root');
    const password = configService.get<string>('MONGO_INITDB_ROOT_PASSWORD', 'rootpassword');

    const database =
      configService.get<string>('MONGO_DB') ||
      configService.get<string>('MONGO_INITDB_DATABASE') ||
      'pep_nao_relacional';

    const uri = `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}?authSource=admin`;

    const isDev = configService.get<string>('NODE_ENV') === 'development';

    return {
      uri,
      retryWrites: true,
      w: 'majority',
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