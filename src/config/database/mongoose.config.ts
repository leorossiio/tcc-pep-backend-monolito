import { Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModuleAsyncOptions } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

export const mongooseConfig: MongooseModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const host = configService.get<string>('MONGO_HOST', 'localhost');
    const port = configService.get<number>('MONGO_PORT', 27017);
    const username = configService.get<string>(
      'MONGO_INITDB_ROOT_USERNAME',
      'root',
    );
    const password = configService.get<string>(
      'MONGO_INITDB_ROOT_PASSWORD',
      'rootpassword',
    );

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
      maxPoolSize: 20,
      connectionFactory: (connection: Connection) => {
        if (isDev) {
          // Logger instanciado uma vez, fora do callback de debug — antes era
          // recriado a cada query do Mongo.
          const logger = new Logger('MongoDB');
          connection.set(
            'debug',
            (collectionName: string, method: string, query: unknown) => {
              logger.debug(
                `${collectionName}.${method}(${JSON.stringify(query)})`,
              );
            },
          );
        }

        return connection;
      },
    };
  },
};
