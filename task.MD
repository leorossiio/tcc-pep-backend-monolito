ETAPA 1 — Entities + Schemas

Task 1: Criar os schemas Mongoose de HistoricoClinico e ConsultaLaudo com todos os campos do diagrama (objetivo: MongoDB sabe o formato dos documentos)
ETAPA 2 — Módulos + Conexão com BD

Task 2: Configurar TypeOrmModule e MongooseModule no AppModule via .env (objetivo: aplicação consegue falar com os dois bancos ao subir)
Task 10: Registrar entities/schemas em cada module filho (objetivo: cada módulo declara seus próprios recursos de BD)
ETAPA 3 — API no ar

Task 3: Preencher todos os DTOs com class-validator (objetivo: API rejeita dados inválidos na entrada)
Task 4 + 5: Controllers com CRUD básico para PG e Mongo (objetivo: todos os endpoints respondem, mesmo sem lógica real)
ETAPA 4 — Lógica de negócio

Task 6 + 7: Repositories com queries reais — TypeORM (PG) e Mongoose (Mongo) (objetivo: acesso ao banco isolado e testável)
Task 8 + 9: Services com regras — hash de CPF, classificação de risco, log de auditoria automático (objetivo: o sistema se comporta corretamente)
ETAPA 5 — Common

Task 11: HttpExceptionFilter global (objetivo: toda exceção retorna JSON padronizado)
Task 12: LoggingInterceptor (objetivo: cada requisição gera log com método, rota e tempo de resposta)
Task 13: crypto.util.ts com hash SHA-256 do CPF (objetivo: CPF nunca é salvo em texto puro)
Task 14 + 15: Aplicar tudo no main.ts e validar que a API sobe sem erros (objetivo: sistema pronto para os testes de carga do k6)
