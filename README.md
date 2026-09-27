# Syntax Wear API

API REST para o e-commerce de moda **Syntax Wear**, desenvolvida com Node.js, TypeScript e Fastify. O projeto reúne autenticação de usuários, gerenciamento de produtos e categorias, criação de pedidos com controle de estoque e integração com Stripe para pagamentos.

Os dados são armazenados em PostgreSQL com Prisma ORM. A aplicação utiliza uma arquitetura em camadas, separando rotas, controllers, serviços e acesso ao banco de dados.

## Funcionalidades

- Cadastro e login com e-mail e senha, com hash de senhas via bcrypt.
- Login com credencial do Google e autenticação JWT.
- Perfis de acesso `USER` e `ADMIN`, com administração de produtos e categorias restrita a administradores.
- Catálogo com paginação, busca textual, filtros por categoria e preço e ordenação.
- Produtos com cores, tamanhos, URLs de imagens e quantidade em estoque.
- Desativação de produtos e categorias, preservando os registros no banco. Desativar uma categoria também desativa seus produtos.
- Criação de pedidos com validação de estoque, registro do preço de cada item e cálculo do total com Decimal.js.
- Gravação do pedido e baixa de estoque em uma transação Prisma.
- Consulta, atualização e cancelamento de pedidos.
- Checkout Stripe com cartão em reais e webhook para atualização do status de pagamento.
- Documentação interativa com OpenAPI e Scalar.
- Testes com Vitest.

## Tecnologias

| Tecnologia | Uso |
| --- | --- |
| Node.js e TypeScript | Execução e tipagem da aplicação |
| Fastify 5 | Servidor HTTP e definição das rotas |
| PostgreSQL e Prisma 5 | Persistência e acesso ao banco de dados |
| Zod | Validação de dados de entrada |
| JWT, cookies e bcrypt | Autenticação e hash de senhas |
| Google Auth Library | Validação da credencial do Google |
| Stripe | Sessões de checkout e webhooks |
| Decimal.js | Cálculos de valores monetários |
| OpenAPI e Scalar | Documentação da API |
| Vitest | Testes automatizados e cobertura |
| Docker Compose | Banco PostgreSQL para desenvolvimento local |

## Executando localmente

### Pré-requisitos

- Node.js 22.12 ou superior na linha 22, com npm.
- PostgreSQL disponível localmente ou em um serviço externo, como Supabase.
- Docker com Docker Compose, caso utilize o banco fornecido pelo projeto.
- Credenciais do Google e do Stripe para utilizar as respectivas integrações.

### 1. Instale as dependências

```bash
git clone https://github.com/jasielrasec18-dev/syntax-wear-api.git
cd syntax-wear-api
npm ci
```

### 2. Configure o ambiente

Copie `.env.example` para `.env`. No PowerShell:

```powershell
Copy-Item .env.example .env
```

No Linux ou macOS:

```bash
cp .env.example .env
```

O arquivo de exemplo contém uma conexão com Supabase. Para usar o PostgreSQL do Docker Compose, substitua `DATABASE_URL` pela conexão local:

```dotenv
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
DATABASE_URL="postgresql://docker:docker@localhost:5432/ecommerce?schema=public"
JWT_SECRET="substitua-por-um-segredo-aleatorio"
LOG_LEVEL=info
```

| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | URL de conexão com o PostgreSQL |
| `JWT_SECRET` | Segredo usado para assinar e verificar os tokens JWT |
| `PORT` | Porta HTTP; padrão: `3000` |
| `HOST` | Endereço de escuta; padrão: `0.0.0.0` |
| `NODE_ENV` | Em `production`, habilita a opção `secure` dos cookies de autenticação |
| `LOG_LEVEL` | Nível dos logs; padrão: `info` |
| `GOOGLE_CLIENT_ID` | Client ID utilizado para validar a credencial enviada em `/auth/google` |
| `STRIPE_SECRET_KEY` | Chave secreta do Stripe para checkout e processamento do webhook |
| `STRIPE_WEBHOOK_SECRET_KEY` | Segredo de assinatura do webhook Stripe |

`UPLOAD_DIR` consta no `.env.example`, mas não é utilizado pelas rotas atuais. As imagens dos produtos são informadas por URLs.

### 3. Prepare o banco de dados

Se optar pelo banco local:

```bash
docker compose up -d
```

O Compose inicia um PostgreSQL 15 na porta `5432`. A API é executada separadamente pelo npm.

Gere o Prisma Client e crie a estrutura do banco:

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
```

As migrations estão ignoradas no `.gitignore` atual. Em um clone novo, o comando acima gera a migration inicial a partir de `prisma/schema.prisma`.

### 4. Inicie a API

```bash
npm run dev
```

- API: [http://localhost:3000](http://localhost:3000)
- Documentação interativa: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
- Status do servidor: [http://localhost:3000/health](http://localhost:3000/health)

Para compilar e executar o código gerado:

```bash
npm run build
npm start
```

### Dados de demonstração

O seed cria usuários, um administrador, categorias, produtos e pedidos de exemplo:

```bash
npm run prisma:seed
```

**Atenção:** o seed apaga os usuários, categorias, produtos, pedidos e itens existentes antes de inserir os exemplos. Execute-o apenas em um banco de desenvolvimento que possa ser recriado.

## Autenticação

O cadastro em `POST /auth/register` retorna `{ user, token }`. Esse token pode ser enviado no cabeçalho das requisições protegidas:

```http
Authorization: Bearer SEU_TOKEN
```

O login por senha e o login com Google retornam `{ user }` e definem o cookie HTTP-only `syntaxwear.token`, com duração de um dia. Para autenticação por cookie no frontend, envie as requisições com `credentials: "include"`.

O logout limpa o cookie de autenticação. A duração do cookie não representa uma expiração do JWT: o código atual não define `expiresIn` na assinatura dos tokens.

Novos cadastros recebem o perfil `USER`. Para testar a administração em um banco local, é possível alterar o campo `role` de um usuário para `ADMIN` pelo Prisma Studio:

```bash
npm run prisma:studio
```

## Rotas

Os caminhos abaixo são relativos à URL base da API. Consulte `/api-docs` para os schemas documentados nas rotas.

| Método | Rota | Descrição | Acesso na rota |
| --- | --- | --- | --- |
| `GET` | `/` | Informações da API | Público |
| `GET` | `/health` | Status do servidor | Público |
| `POST` | `/auth/register` | Cadastro de usuário | Público |
| `POST` | `/auth/login` | Login por e-mail e senha | Público |
| `POST` | `/auth/google` | Login com credencial do Google | Público |
| `GET` | `/auth/profile` | Perfil do usuário autenticado | Autenticado |
| `POST` | `/auth/logout` | Remoção do cookie de autenticação | Autenticado |
| `GET` | `/products` | Listagem de produtos | Público |
| `GET` | `/products/:id` | Detalhes de um produto | Público |
| `POST` | `/products` | Criação de produto | Administrador |
| `PUT` | `/products/:id` | Atualização de produto | Administrador |
| `DELETE` | `/products/:id` | Desativação de produto | Administrador |
| `GET` | `/categories` | Listagem de categorias | Público |
| `GET` | `/categories/:id` | Detalhes de uma categoria | Público |
| `POST` | `/categories` | Criação de categoria | Administrador |
| `PUT` | `/categories/:id` | Atualização de categoria | Administrador |
| `DELETE` | `/categories/:id` | Desativação da categoria e de seus produtos | Administrador |
| `GET` | `/orders` | Listagem de pedidos | Autenticado |
| `GET` | `/orders/:id` | Detalhes de um pedido | Autenticado |
| `POST` | `/orders` | Criação de pedido | Autenticado |
| `PUT` | `/orders/:id` | Atualização de status ou endereço | Autenticado |
| `DELETE` | `/orders/:id` | Cancelamento de pedido | Autenticado |
| `POST` | `/stripe/checkout` | Criação de pedido e sessão de checkout | Público |
| `POST` | `/stripe/webhook` | Recebimento de eventos Stripe | Assinatura Stripe |

### Exemplo de cadastro

Envie para `POST /auth/register` com `Content-Type: application/json`:

```json
{
  "firstName": "Ana",
  "lastName": "Silva",
  "email": "ana@example.com",
  "password": "senha-de-exemplo"
}
```

### Exemplo de consulta ao catálogo

```http
GET /products?page=1&limit=10&search=camiseta&minPrice=20&maxPrice=150&sortBy=price&sortOrder=asc
```

Também é possível filtrar por `categoryId`. A listagem retorna `data`, `total`, `page`, `limit` e `totalPages`.

## Pedidos e pagamentos

Os status disponíveis são `PENDING`, `PAID`, `SHIPPED`, `DELIVERED` e `CANCELLED`.

Na criação, a API consulta os preços dos produtos no banco, valida a quantidade disponível, soma os itens ao `shippingCost` informado e registra o pedido como `PENDING`. O estoque é reduzido nesse momento. O cancelamento altera o status para `CANCELLED` e não devolve os itens ao estoque.

O endpoint `POST /stripe/checkout` recebe os dados do pedido, cria o pedido e retorna um `sessionId` do Stripe. O webhook verifica a assinatura dos eventos e trata `checkout.session.completed` para marcar o pedido como `PAID`. Há também tratamento de `charge.failed` quando o evento contém `orderId` nos metadados.

Na implementação atual, os redirecionamentos do checkout são `http://localhost:5173/success` e `http://localhost:5173/cancel`, definidos em `src/services/stripe.service.ts`. O frete integra o total do pedido no banco, mas não é incluído nos itens enviados à sessão Stripe.

## Estrutura do projeto

```text
prisma/
  schema.prisma        # Modelos e relacionamentos do banco
  seed.ts              # Dados de demonstração
src/
  controllers/         # Entrada das requisições e respostas HTTP
  middlewares/         # Autenticação, autorização e tratamento de erros
  routes/              # Endpoints e schemas OpenAPI
  services/            # Regras de negócio e integrações
  types/               # Tipos compartilhados
  utils/               # Prisma Client, validadores e utilitários
  app.ts               # Configuração da aplicação Fastify
  server.ts            # Inicialização do servidor
tests/                 # Testes de autenticação, catálogo, pedidos e Stripe
docker-compose.yml     # PostgreSQL local
```

O modelo de dados é composto por `User`, `Category`, `Product`, `Order` e `OrderItem`. Produtos pertencem a categorias; pedidos podem estar associados a usuários e possuem itens que registram produto, preço, quantidade e tamanho.

## Testes

A suíte inclui testes de cadastro, login, produtos, categorias, pedidos e do serviço de checkout Stripe. Parte utiliza mocks do Prisma e do Stripe; os testes de autenticação acessam o banco configurado em `DATABASE_URL`.

**Use um banco exclusivo para testes:** a suíte de autenticação cria e remove usuários, e uma rotina de limpeza remove e-mails que contêm `test-`. O setup atual carrega `.env` e não provisiona um banco de testes automaticamente.

```bash
# Executar uma vez
npm test -- --run

# Executar em modo de acompanhamento
npm test

# Abrir a interface do Vitest
npm run test:ui

# Gerar cobertura em uma execução
npm run test:coverage -- --run
```

## Licença

O `package.json` declara a licença ISC.
