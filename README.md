# ?? Benchmarking de Persistência Poliglota em Prontuários Eletrônicos

Este repositório contém os artefatos de software, infraestrutura e scripts de teste desenvolvidos para o Trabalho de Conclusão de Curso (TCC) de Engenharia da Computação no Centro Universitário UniFacens.

**Título do Projeto:** Benchmarking de Persistência Poliglota: Avaliação do Desempenho de Arquiteturas Monolíticas e Baseadas em Microsserviços no Acesso a Prontuários Eletrônicos em Situações de Emergência.

## ?? Equipe e Orientação
* **Felipe Rusig de Paiva** (RA: 212031)
* **Guilherme Massayuki Yokoda de Moraes** (RA: 223618)
* **Leonardo Rossi de Oliveira** (RA: 222410) - Líder
* **Orientador:** Prof. Marco Antonio Montebello Junior

## ?? Objetivo da Pesquisa
O projeto visa avaliar experimentalmente o desempenho de uma arquitetura baseada em microsserviços em comparação a uma arquitetura monolítica, ambas utilizando o conceito de Persistência Poliglota (uso de diferentes tecnologias de banco de dados conforme as características dos dados). O foco é a resiliência e a mitigação de alta latência no acesso a Prontuários Eletrônicos de Pacientes (PEP) durante picos de emergência médica.

Este trabalho está alinhado aos Objetivos de Desenvolvimento Sustentável (ODS) da ONU:
* **ODS 3 (Saúde e Bem-Estar):** Redução de latências sistêmicas no acesso a dados críticos que podem custar vidas.
* **ODS 9 (Indústria, Inovação e Infraestrutura):** Promoção de infraestruturas de software resilientes e escaláveis.

## ??? Arquitetura dos Protótipos
O estudo desenvolve e compara dois protótipos funcionais:

1. **Protótipo A (Monolítico):** Aplicação que usa uma única base de código para implementar todo o sistema, comunicando-se tanto com o PostgreSQL (para dados estruturados de triagem) quanto com o MongoDB (para dados semiestruturados de laudos).
2. **Protótipo B (Microsserviços):** Abordagem que desenvolve a aplicação como um conjunto de pequenos serviços autônomos. Utiliza o padrão *Database-per-service* (Banco de dados por serviço), onde o `ms-triagem` possui domínio exclusivo sobre o PostgreSQL e o `ms-laudos` possui domínio sobre o MongoDB, com roteamento feito via API Gateway.

## ?? Tecnologias Utilizadas
* **Back-end:** Node.js + NestJS (TypeScript)
* **Bancos de Dados:** PostgreSQL (Relacional) e MongoDB (NoSQL/Orientado a Documentos)
* **Infraestrutura:** Docker e Docker Compose
* **Benchmarking (Laboratório):** Grafana k6
* **Monitoramento:** Prometheus + Grafana

## ?? Como Executar o Projeto Localmente

### 1. Pré-requisitos
Antes de iniciar, certifique-se de que os seguintes softwares estão instalados na sua máquina:
* **Node.js** (versão 20 ou superior recomendada)
* **NPM** (gerenciador de pacotes, já incluído com o Node.js)
* **Docker Desktop** (necessário para execução dos bancos de dados)

### 2. Clonando o Repositório
Clone este repositório em sua máquina:
```bash
git clone https://github.com/seu-usuario/tcc-prontuario-poliglota-2026-engenharia-de-computacao.git
```
Em seguida, navegue até a pasta do projeto:
```bash
cd tcc-pep-backend-monolito
```

### 3. Configuração das Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:
```dotenv
# Configurações do PostgreSQL
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=
POSTGRES_PORT=

# Configurações do MongoDB
MONGO_INITDB_ROOT_USERNAME=
MONGO_INITDB_ROOT_PASSWORD=
MONGO_PORT=
```
**Importante:** Preencha os valores de acordo com o seu ambiente local.

### 4. Instalação das Dependências
No terminal, certifique-se de estar na pasta raiz do projeto e execute:
```bash
npm install
```
Este comando instalará todas as dependências necessárias para a execução da aplicação.

### 5. Inicialização da Infraestrutura (Bancos de Dados)
O projeto utiliza containers Docker para execução dos bancos de dados PostgreSQL e MongoDB.
Para subir os contêineres dos bancos de dados e serviços, execute:
```bash
docker compose up -d
```
Esse comando irá baixar as imagens necessárias (caso ainda não estejam disponíveis) e iniciar os contêineres em segundo plano.

### 6. Execução da Aplicação
Com o ambiente configurado e os bancos em execução, inicie a aplicação em modo de desenvolvimento:
```bash
npm run start:dev
```
Esse modo habilita atualização automática (hot reload) e facilita o desenvolvimento.

## ??? Ferramentas Recomendadas
* **DBeaver:** Cliente universal de banco de dados para gerenciar PostgreSQL, MongoDB e outras bases. Útil para consultas SQL, modelagem e administração.
* **Postman:** Ferramenta para testar APIs REST, validar endpoints e automatizar coleções de requisições.
* **VS Code:** Editor recomendado para desenvolvimento do projeto, com extensões para Node.js, Docker e linting.
* **Docker Desktop:** Interface gráfica para gerenciamento de containers, imagens e volumes Docker.
* **pgAdmin:** Alternativa focada em administração do PostgreSQL, consultas e manutenção do banco.
* **GitHub Desktop:** Interface simplificada para versionamento Git e integração com repositórios remotos.

## ?? Laboratório de Testes (Benchmarking)
(TODO)

---

Centro Universitário UniFacens — Engenharia da Computação — 2026
