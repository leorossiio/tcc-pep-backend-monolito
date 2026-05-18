import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { Histogram, Counter, register } from 'prom-client';

// ── Métricas Prometheus registradas uma única vez ────────────────────────────

const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duração das requisições HTTP em segundos',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

const httpTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total de requisições HTTP',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
});

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const { method } = req;
    // Normaliza o path: /atendimentos/uuid-aqui → /atendimentos/:id
    const path = req.route?.path ?? req.url;
    const inicio = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duracao = (Date.now() - inicio) / 1000;
        const status = String(res.statusCode);

        httpDuration.labels(method, path, status).observe(duracao);
        httpTotal.labels(method, path, status).inc();

        this.logger.log(`${method} ${path} ${status} — ${(duracao * 1000).toFixed(1)}ms`);
      }),
    );
  }
}
