import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { typeOrmConfig } from './config/database/typeorm.config';
import { mongooseConfig } from './config/database/mongoose.config';
import { PacientesModule } from './modules/pacientes/pacientes.module';
import { MedicosModule } from './modules/medicos/medicos.module';
import { AtendimentosModule } from './modules/atendimentos/atendimentos.module';
import { LogsAuditoriaModule } from './modules/logs-auditoria/logs-auditoria.module';
import { HistoricoClinicosModule } from './modules/historico-clinicos/historico-clinicos.module';
import { ConsultasLaudosModule } from './modules/consultas-laudos/consultas-laudos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: { enabled: true },
    }),
    TypeOrmModule.forRootAsync(typeOrmConfig),
    MongooseModule.forRootAsync(mongooseConfig),
    PacientesModule,
    MedicosModule,
    AtendimentosModule,
    LogsAuditoriaModule,
    HistoricoClinicosModule,
    ConsultasLaudosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
