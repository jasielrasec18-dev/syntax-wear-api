# 📊 PLANO DE CORREÇÕES - SEGURANÇA, PERFORMANCE E MANUTENIBILIDADE
## API Syntax Wear (Node.js + Fastify + TypeScript + PostgreSQL)

**Data de análise:** 01 de setembro de 2026  
**Última atualização:** 01 de setembro de 2026  
**Total de issues identificados:** 30  
**Issues resolvidos:** 6 ✅  
**Issues pendentes:** 24 ⚠️  
**Severidade Crítica pendente:** 3 🔴  
**Severidade Alta pendente:** 6 🟠  
**Severidade Média pendente:** 14 🟡  
**Severidade Baixa pendente:** 1 🟢

---

## ✅ MELHORIAS JÁ IMPLEMENTADAS

### 1.1 **CREDENCIAIS EXPOSTAS NO GIT** ✅ **RESOLVIDO**
- ✅ Arquivo `.env.example` criado sem valores reais
- ✅ `.gitignore` configurado corretamente incluindo `.env`
- ⚠️ **PENDENTE:** Verificar histórico git e rotacionar credenciais se necessário

### 1.2 **AUTENTICAÇÃO COMENTADA** ✅ **RESOLVIDO**
- ✅ Middleware `authenticate` ativo em `orders.routes.ts`
- ✅ Middleware `requireAdmin` implementado e aplicado em:
  - `products.routes.ts`: POST, PUT, DELETE
  - `categories.routes.ts`: POST, PUT, DELETE

### 1.3 **SENHAS RETORNADAS NA RESPOSTA** ✅ **RESOLVIDO**
- ✅ `auth.service.ts` removendo campo `password` via:
  - `select` específico em `registerUser` (não inclui password)
  - Destructuring em `loginUser` (`const { password, ...userWithoutPassword } = user`)

### 3.3 **LOGS COM INFORMAÇÕES SENSÍVEIS** ✅ **PARCIALMENTE RESOLVIDO**
- ✅ Logger configurado com serializers para ocultar body e headers
- ✅ Não loga Authorization headers

### 5.6 **VARIÁVEIS DE AMBIENTE SEM VALIDAÇÃO** ✅ **PARCIALMENTE RESOLVIDO**
- ✅ Arquivo `.env.example` criado com documentação
- ⚠️ **PENDENTE:** Validação Zod das variáveis de ambiente

### Melhorias Bonus Implementadas
- ✅ Endpoint `/health` para healthchecks
- ✅ Validação Zod robusta em todos os schemas
- ✅ Soft delete em cascata implementado

---

## 🔴 1. PROBLEMAS CRÍTICOS DE SEGURANÇA

### 1.2 **AUTENTICAÇÃO COMENTADA** ⚠️ **CRÍTICO**

**Arquivos:**
- `src/routes/products.routes.ts` (linha 6)
- `src/routes/categories.routes.ts` (linha 5)
- `src/routes/orders.routes.ts` (linha 5)

**Descrição:** Middleware `authenticate` está **COMENTADO** em todas as rotas, deixando endpoints sensíveis **TOTALMENTE ABERTOS**:

```typescript
//fastify.addHook("onRequest", authenticate); // ❌ COMENTADO!
```

**Risco:**
- Qualquer pessoa pode criar/editar/deletar produtos e categorias
- Listar todos os pedidos sem autenticação
- Ver dados de usuários em pedidos (CPF, telefone, email)
- Cancelar pedidos de outros usuários

**Ação necessária:**
1. **DESCOMENTAR imediatamente** o middleware em:
   - `products.routes.ts`: POST, PUT, DELETE devem exigir auth + role ADMIN
   - `categories.routes.ts`: POST, PUT, DELETE devem exigir auth + role ADMIN
   - `orders.routes.ts`: Todas as rotas devem exigir autenticação

---

### 1.3 **SENHAS RETORNADAS NA RESPOSTA** ⚠️ **ALTO**

**Arquivo:** `src/services/auth.service.ts` (linhas 30, 46)

**Descrição:** As funções `registerUser` e `authenticateUser` retornam o objeto `user` **completo**, incluindo o hash bcrypt da senha:

```typescript
return newUser; // ❌ Inclui campo password com hash bcrypt
return user; // ❌ Inclui campo password com hash bcrypt
```

Isso é enviado ao cliente em `auth.controller.ts`:
```typescript
reply.status(201).send({ user, token }); // ❌ Expõe hash da senha
```

**Risco:**
- Hashes bcrypt podem ser atacados offline (rainbow tables, força bruta)
- Exposição desnecessária de dados sensíveis

**Ação necessária:**
```typescript
// auth.service.ts
export const registerUser = async (payload: RegisterRequest) => {
  // ... código de criação ...
  
  const { password, ...userWithoutPassword } = newUser;
  return userWithoutPassword;
};

// Ou usar Prisma select:
const newUser = await prisma.user.create({
  data: { ... },
  select: {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    role: true,
    createdAt: true
    // ❌ NÃO incluir password
  }
});
```

---

### 1.4 **FALTA DE VALIDAÇÃO DE AUTORIZAÇÃO EM PEDIDOS** ⚠️ **ALTO**

**Arquivo:** `src/services/orders.service.ts` (funções `getOrderById`, `updateOrder`, `deleteOrder`)

**Descrição:** Não há verificação se o usuário autenticado pode acessar/modificar o pedido. Qualquer usuário autenticado pode:
- Ver pedidos de outros usuários: `GET /orders/:id`
- Atualizar status de pedidos de outros: `PUT /orders/:id`
- Cancelar pedidos de outros: `DELETE /orders/:id`

**Risco:** Quebra de privacidade e integridade de dados.

**Ação necessária:**
```typescript
// Em orders.service.ts - getOrderById
export async function getOrderById(id: number, requestingUserId: number, isAdmin: boolean) {
  const order = await prisma.order.findUnique({ where: { id }, include: {...} });
  
  if (!order) throw new Error('Pedido não encontrado');
  
  // Verificar se o usuário pode acessar o pedido
  if (!isAdmin && order.userId !== requestingUserId) {
    throw new Error('Você não tem permissão para acessar este pedido');
  }
  
  return order;
}
```

---

### 1.5 **N+1 QUERIES EM LISTAGEM DE PEDIDOS** ⚠️ **CRÍTICO**

**Arquivo:** `src/services/orders.service.ts` (linhas 22-46)

**Descrição:** A query `getOrders` usa `include` para carregar `user`, `items`, `product` e `category` para **TODOS** os pedidos da página:

```typescript
include: {
  user: { select: { id, firstName, lastName, email } },
  items: {
    include: {
      product: {
        include: { category: true }
      }
    }
  }
}
```

**Impacto:**
- Se um pedido tem 10 items, são **10 queries adicionais** para buscar produtos + 10 queries para categorias
- Página com 10 pedidos = **1 query (orders) + até 200 queries (items/products/categories)**
- Latência altíssima em produção
- Sobrecarga no banco PostgreSQL

**Ação necessária:**
3. Para metodos de get all, pode deixar sem o include, deixar apenas nos metodos de get by id

---

## 🟠 2. PROBLEMAS ALTOS DE SEGURANÇA

### 2.1 **AUSÊNCIA DE RATE LIMITING** ⚠️ **ALTO**

**Arquivo:** `src/app.ts`  
**Descrição:** Não há rate limiting implementado em nenhuma rota.

**Risco:**
- **Ataques de força bruta** em `/auth/register` e `/auth/signin`
- **DoS (Denial of Service)** via requisições massivas
- **Scraping de dados** de produtos/categorias sem limitação
- **Spam de pedidos** falsos no endpoint `POST /orders`

**Ação necessária:**
```typescript
// Adicionar em src/app.ts
import rateLimit from '@fastify/rate-limit';

fastify.register(rateLimit, {
  max: 100, // máximo de requisições
  timeWindow: '15 minutes', // janela de tempo
  allowList: ['127.0.0.1'], // IPs confiáveis
  redis: redisClient // usar Redis em produção
});

// Rate limit específico para auth
fastify.register(rateLimit, {
  max: 5,
  timeWindow: '15 minutes',
  allowList: [],
  nameSpace: 'auth-'
}, { prefix: '/auth' });
```

**Instalar:** `npm install @fastify/rate-limit`

---

### 2.2 **AUSÊNCIA DE ÍNDICES NO BANCO DE DADOS** ⚠️ **ALTO**

**Arquivo:** `prisma/schema.prisma`

**Descrição:** Faltam índices em campos frequentemente filtrados:

**Campos sem índices:**
- `Product.categoryId` (FK, usado em WHERE)
- `Product.active` (filtro comum)
- `Product.price` (range queries)
- `Product.slug` (já tem `@unique`, ok)
- `Order.status` (filtro comum)
- `Order.userId` (FK, usado em WHERE)
- `Order.createdAt` (range queries, ordenação)
- `OrderItem.orderId` (FK)
- `OrderItem.productId` (FK)
- `Category.active` (filtro comum)

**Impacto:**
- Full table scan em queries com WHERE/ORDER BY
- Latência crescente conforme dados aumentam
- CPU do banco sobrecarregado

**Ação necessária:**
```prisma
model Product {
  // ... campos existentes
  @@index([categoryId])
  @@index([active])
  @@index([price])
  @@index([createdAt])
}

model Order {
  // ... campos existentes
  @@index([status])
  @@index([userId])
  @@index([createdAt])
}

model OrderItem {
  // ... campos existentes
  @@index([orderId])
  @@index([productId])
}

model Category {
  // ... campos existentes
  @@index([active])
}
```

Executar: `npm run prisma:migrate`

---

### 2.3 **AUSÊNCIA DE CACHE** ⚠️ **ALTO**

**Arquivos:** Todos os services

**Descrição:** Não há implementação de cache em:
- Listagem de produtos (rota mais acessada)
- Listagem de categorias
- Detalhes de produto individual
- Detalhes de categoria

**Impacto:**
- Cada requisição bate no banco de dados
- Latência desnecessária (50-200ms por query)
- Sobrecarga no PostgreSQL em alta concorrência

**Ação necessária:**
```typescript
// Adicionar Redis
import { Redis } from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

// Em products.service.ts - getProducts
export const getProducts = async (filter: ProductFilters) => {
  const cacheKey = `products:${JSON.stringify(filter)}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  const result = await prisma.product.findMany({ ... });
  
  await redis.setex(cacheKey, 300, JSON.stringify(result)); // 5min TTL
  return result;
};
```

**Instalar:** `npm install ioredis @types/ioredis`

---

## 🟡 3. PROBLEMAS MÉDIOS DE SEGURANÇA

### 3.1 **CORS CONFIGURADO COMO `origin: true`** ⚠️ **MÉDIO**

**Arquivo:** `src/app.ts` (linha 21)

**Descrição:**
```typescript
fastify.register(cors, {
	origin: true, // ❌ Aceita QUALQUER origem
	credentials: true,
});
```

**Risco:**
- Qualquer site pode fazer requisições para a API
- CSRF (Cross-Site Request Forgery) facilitado
- Credenciais (cookies/tokens) podem ser enviadas de qualquer origem

**Ação necessária:**
```typescript
fastify.register(cors, {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://syntaxwear.com.br', 'https://admin.syntaxwear.com.br']
    : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
});
```

---

### 3.2 **AUSÊNCIA DE HTTPS ENFORCEMENT** ⚠️ **MÉDIO**

**Arquivo:** `src/app.ts`

**Descrição:** O servidor roda em HTTP puro (`http://localhost:3000`). Não há redirect automático para HTTPS ou configuração HSTS.

**Risco:**
- Tokens JWT trafegam em texto claro
- Credenciais de login podem ser interceptadas (man-in-the-middle)
- Cookies/sessões vulneráveis a eavesdropping

**Ação necessária:**
```typescript
// Em produção, usar HTTPS + HSTS
if (process.env.NODE_ENV === 'production') {
  fastify.register(helmet, {
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  });
}
```

---

### 3.3 **LOGS COM INFORMAÇÕES SENSÍVEIS** ⚠️ **MÉDIO**

**Arquivo:** `src/app.ts` (linha 11)

**Descrição:**
```typescript
const fastify = Fastify({
	logger: true, // ❌ Loga TODAS as requisições, incluindo body com senhas
});
```

**Risco:** 
- Senhas em texto claro podem ser gravadas em logs
- Tokens JWT podem vazar em logs
- Dados pessoais (CPF, telefone) gravados em arquivos de log

**Ação necessária:**
```typescript
const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    serializers: {
      req(request) {
        return {
          method: request.method,
          url: request.url,
          // ❌ NÃO logar body, headers com Authorization
        };
      },
      res(reply) {
        return {
          statusCode: reply.statusCode,
        };
      }
    }
  }
});
```

---

### 3.4 **AUSÊNCIA DE INPUT SANITIZATION EM CAMPOS JSON** ⚠️ **MÉDIO**

**Arquivo:** `src/services/orders.service.ts` (linha 125)

**Descrição:** O campo `shippingAddress` é salvo como JSON sem sanitização:

```typescript
shippingAddress: data.shippingAddress as any, // ❌ Pode conter scripts maliciosos
```

**Risco:** 
- XSS (Cross-Site Scripting) se o endereço for renderizado em frontend sem escape
- Injeção de caracteres especiais que podem quebrar JSON parsing

**Ação necessária:**
- Validar e sanitizar strings no Zod schema:
```typescript
street: z.string().min(1).max(200).trim(),
```
- Usar biblioteca `DOMPurify` ou `xss` no frontend ao renderizar

---

### 3.5 **FALTA DE PROTEÇÃO CSRF** ⚠️ **MÉDIO**

**Descrição:** Não há implementação de tokens CSRF para operações de estado mutável (POST, PUT, DELETE).

**Risco:** Atacante pode forçar usuário autenticado a executar ações não intencionais (criar pedido, deletar produto).

**Ação necessária:**
```typescript
import csrf from '@fastify/csrf-protection';

fastify.register(csrf);
```

---

### 3.6 **FALTA DE LIMITES EM ARRAYS DE ENTRADA** ⚠️ **MÉDIO**

**Arquivo:** `src/utils/validators.ts`

**Descrição:** Arrays em `createProductSchema` não têm limite de tamanho:

```typescript
colors: z.array(z.string()).optional(), // ❌ Pode ter 10.000 cores
images: z.array(z.string()).optional(), // ❌ Pode ter 1.000 imagens
```

**Impacto:**
- Atacante pode enviar arrays massivos, travando o servidor
- JSON parsing pode consumir memória excessiva
- DoS via payload gigante

**Ação necessária:**
```typescript
colors: z.array(z.string()).max(10, "Máximo 10 cores").optional(),
images: z.array(z.string().url()).max(20, "Máximo 20 imagens").optional(),
sizes: z.array(z.string()).max(10, "Máximo 10 tamanhos").optional(),
```

---

## ⚡ 4. PROBLEMAS DE PERFORMANCE

### 4.1 **PAGINAÇÃO INEFICIENTE COM `OFFSET`** ⚠️ **MÉDIO**

**Arquivos:**
- `src/services/products.service.ts` (linha 38)
- `src/services/categories.service.ts` (linha 19)
- `src/services/orders.service.ts` (linha 26)

**Descrição:**
```typescript
const skip = (Number(page) - 1) * Number(limit);
```

**Impacto:**
- `OFFSET` em SQL é ineficiente para páginas altas (página 100 = pular 990 registros)
- Quanto maior a página, mais lento fica
- Cursor-based pagination seria mais eficiente

**Ação necessária:**
Implementar cursor-based pagination:
```typescript
// Usar lastId em vez de page
const products = await prisma.product.findMany({
  take: limit,
  skip: 1, // pular o cursor
  cursor: lastId ? { id: lastId } : undefined,
  orderBy: { id: 'asc' }
});
```

---

### 4.2 **AUSÊNCIA DE COMPRESSÃO DE RESPOSTA** ⚠️ **MÉDIO**

**Arquivo:** `src/app.ts`

**Descrição:** Não há compressão gzip/brotli nas respostas HTTP.

**Impacto:**
- Listagens grandes (100 produtos) podem ter 200KB+ de payload
- Desperdício de bandwidth
- Latência alta em redes lentas

**Ação necessária:**
```typescript
import compress from '@fastify/compress';

fastify.register(compress, {
  global: true,
  threshold: 1024, // comprimir se > 1KB
  encodings: ['gzip', 'deflate']
});
```

**Instalar:** `npm install @fastify/compress`

---

## 🛠️ 5. PROBLEMAS DE MANUTENIBILIDADE

### 5.1 **USO EXCESSIVO DE `any`** ⚠️ **ALTO**

**Arquivos:**
- `src/services/products.service.ts` (linha 7)
- `src/services/categories.service.ts` (linha 6)
- `src/services/orders.service.ts` (linhas 9, 125, 173)

**Descrição:**
```typescript
const where: any = {}; // ❌ Perde type safety
shippingAddress: data.shippingAddress as any, // ❌ Bypass de tipos
```

**Impacto:**
- TypeScript não detecta erros em tempo de desenvolvimento
- Refatorações arriscadas (não sabe onde tipos são usados)
- Bugs em runtime que poderiam ser prevenidos

**Ação necessária:**
```typescript
import { Prisma } from '@prisma/client';

const where: Prisma.ProductWhereInput = {};
const orderBy: Prisma.ProductOrderByWithRelationInput = {};

// Para Json fields
shippingAddress: data.shippingAddress as Prisma.JsonObject,
```

---

### 5.2 **DUPLICAÇÃO DE CÓDIGO EM CONTROLLERS** ⚠️ **MÉDIO**

**Arquivos:**
- `src/controllers/products.controller.ts`
- `src/controllers/categories.controller.ts`

**Descrição:** Lógica de geração de slug é duplicada:

```typescript
// products.controller.ts (linha 13)
body.slug = slugify(body.name, { lower: true, strict: true, locale: "pt" });

// categories.controller.ts (linha 12)
body.slug = slugify(body.name, { lower: true, strict: true, locale: "pt" });
```

**Impacto:** Alterações precisam ser replicadas em múltiplos lugares.

**Ação necessária:**
```typescript
// src/utils/slug.ts
export function generateSlug(text: string): string {
  return slugify(text, { lower: true, strict: true, locale: "pt" });
}

// Usar em controllers
body.slug = generateSlug(body.name);
```

---

### 5.3 **FALTA DE LOGGING ESTRUTURADO** ⚠️ **MÉDIO**

**Arquivos:**
- `src/controllers/products.controller.ts` (linha 64)
- `src/controllers/categories.controller.ts` (linha 37)

**Descrição:**
```typescript
console.error("Erro ao buscar produtos:", error); // ❌ Log não estruturado
```

**Impacto:**
- Difícil rastrear erros em produção
- Não há contextualização (userId, requestId)
- Impossível filtrar/agregar logs em ferramentas de monitoramento

**Ação necessária:**
```typescript
// Usar logger do Fastify
fastify.log.error({
  err: error,
  operation: 'getProducts',
  filters: filter,
  timestamp: new Date().toISOString()
}, 'Erro ao buscar produtos');
```

---

### 5.4 **FALTA DE TESTES** ⚠️ **CRÍTICO**

**Descrição:** Pasta `tests/` existe mas está vazia.

**Impacto:**
- Não há garantia de que funcionalidades funcionam
- Refatorações são arriscadas
- Bugs podem passar para produção
- Impossível fazer CI/CD com confiança

**Ação necessária:**
1. Implementar testes unitários com Vitest:
```bash
npm install -D vitest @vitest/ui
```

2. Exemplo de teste:
```typescript
// tests/auth.service.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { registerUser } from '../src/services/auth.service';

describe('Auth Service', () => {
  it('deve hashear senha ao registrar usuário', async () => {
    const user = await registerUser({
      email: 'test@test.com',
      password: '123456',
      firstName: 'Test',
      lastName: 'User'
    });
    
    expect(user.password).not.toBe('123456');
    expect(user.password).toMatch(/^\$2[ayb]\$.{56}$/); // bcrypt hash
  });
});
```

---

### 5.5 **TRATAMENTO DE ERROS GENÉRICO** ⚠️ **MÉDIO**

**Arquivo:** `src/middlewares/error.middleware.ts`

**Descrição:**
```typescript
return reply.status(500).send({ 
  message: "Erro interno do servidor", 
  debug: error.message // ❌ Expõe stack trace em produção
});
```

**Impacto:**
- Mensagens técnicas podem vazar informações sensíveis (paths, estrutura DB)
- Difícil diferenciar tipos de erro no frontend

**Ação necessária:**
```typescript
export const errorHandler = (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
  // Logar erro completo
  request.log.error(error);
  
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: "Erro de validação",
      errors: error.errors,
    });
  }
  
  // Em produção, não expor detalhes
  const isProduction = process.env.NODE_ENV === 'production';
  
  return reply.status(500).send({ 
    message: "Erro interno do servidor",
    ...(isProduction ? {} : { debug: error.message, stack: error.stack })
  });
};
```

---

### 5.6 **VARIÁVEIS DE AMBIENTE SEM VALIDAÇÃO** ⚠️ **MÉDIO**

**Arquivo:** `src/app.ts` (linha 10)

**Descrição:**
```typescript
const PORT = parseInt(process.env.PORT ?? "3000");
// Não valida JWT_SECRET, DATABASE_URL
```

**Impacto:**
- App pode iniciar com configurações inválidas
- Erros difíceis de debugar em runtime

**Ação necessária:**
```typescript
// src/config/env.ts
import z from 'zod';

const envSchema = z.object({
  PORT: z.string().transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET deve ter no mínimo 32 caracteres"),
});

export const env = envSchema.parse(process.env);

// Usar: env.PORT, env.JWT_SECRET
```

---

### 5.7 **SCHEMAS DUPLICADOS (ZOD VS FASTIFY)** ⚠️ **BAIXO**

**Arquivos:** Rotas vs validators

**Descrição:** Schemas são definidos duas vezes:
1. Fastify schema (OpenAPI) nas rotas
2. Zod schemas em `src/utils/validators.ts`

**Impacto:** Manutenção duplicada. Mudanças precisam ser sincronizadas manualmente.

**Ação necessária:**
Usar biblioteca para gerar Fastify schemas a partir de Zod:
```bash
npm install fastify-zod
```

```typescript
import { buildJsonSchemas } from 'fastify-zod';

const { schemas, $ref } = buildJsonSchemas({
  registerSchema,
  loginSchema,
});

fastify.post('/register', {
  schema: {
    body: $ref('registerSchema'),
    response: { 201: $ref('registerResponseSchema') }
  }
}, register);
```

---

## 📦 6. PROBLEMAS DE DEPENDÊNCIAS

### 6.1 **Versões Incorretas de Dependências**

**Arquivo:** `package.json`

**Versões incorretas:**

| Pacote | Versão no projeto | Versão correta |
|--------|------------------|----------------|
| `bcrypt` | 6.0.0 | 5.1.1 |
| `zod` | 4.1.13 | 3.23.8 |
| `@prisma/client` | 5.21.0 | 5.22.0 |
| `prisma` | 5.21.0 | 5.22.0 |

**Ação necessária:**
```bash
npm install bcrypt@5.1.1 zod@3.23.8 @prisma/client@latest prisma@latest
npm audit
npm audit fix
```

---

## 🎯 PLANO DE EXECUÇÃO

### 📅 **SEMANA 1 - CRÍTICO** (Prioridade Máxima)

#### Dia 1-2: Segurança Imediata
- [ ] **1.1** Rotacionar `DATABASE_URL` no Supabase
- [ ] **1.1** Gerar novo `JWT_SECRET` (mínimo 64 caracteres)
- [ ] **1.1** Atualizar `.env` com novas credenciais
- [ ] **1.1** Criar `.env.example` sem valores reais
- [ ] **1.1** Verificar histórico git: `git log --all --full-history --source -- .env`
- [ ] **1.1** Confirmar `.env` está em `.gitignore`

#### Dia 3-4: Autenticação e Autorização
- [ ] **1.2** Descomentar `authenticate` em `products.routes.ts` (POST, PUT, DELETE)
- [ ] **1.2** Descomentar `authenticate` em `categories.routes.ts` (POST, PUT, DELETE)
- [ ] **1.2** Descomentar `authenticate` em `orders.routes.ts` (todas as rotas)
- [ ] **1.2** Criar `src/middlewares/admin.middleware.ts` com verificação de role
- [ ] **1.2** Aplicar `requireAdmin` em rotas de produtos e categorias
- [ ] **1.4** Implementar autorização por `userId` em `orders.service.ts`

#### Dia 5: Correção de Dados Sensíveis
- [ ] **1.3** Remover campo `password` de `registerUser` em `auth.service.ts`
- [ ] **1.3** Remover campo `password` de `authenticateUser` em `auth.service.ts`
- [ ] **1.3** Testar endpoints `/auth/register` e `/auth/signin`

---

### 📅 **SEMANA 2 - ALTO** (Segurança e Performance)

#### Dia 1-2: Rate Limiting e CORS
- [ ] **2.1** Instalar `@fastify/rate-limit`
- [ ] **2.1** Configurar rate limit global em `app.ts` (100 req/15min)
- [ ] **2.1** Configurar rate limit específico para `/auth` (5 req/15min)
- [ ] **3.1** Restringir CORS em `app.ts` baseado em `NODE_ENV`
- [ ] **3.5** Instalar e configurar `@fastify/csrf-protection`

#### Dia 3-4: Índices no Banco
- [ ] **2.2** Adicionar `@@index([categoryId])` em `Product`
- [ ] **2.2** Adicionar `@@index([active])` em `Product`
- [ ] **2.2** Adicionar `@@index([price])` em `Product`
- [ ] **2.2** Adicionar `@@index([createdAt])` em `Product`
- [ ] **2.2** Adicionar `@@index([status])` em `Order`
- [ ] **2.2** Adicionar `@@index([userId])` em `Order`
- [ ] **2.2** Adicionar `@@index([createdAt])` em `Order`
- [ ] **2.2** Adicionar `@@index([orderId])` em `OrderItem`
- [ ] **2.2** Adicionar `@@index([productId])` em `OrderItem`
- [ ] **2.2** Adicionar `@@index([active])` em `Category`
- [ ] **2.2** Executar `npm run prisma:migrate`

#### Dia 5: Validação de N+1 Queries
- [ ] **1.5** Habilitar logging de queries em `src/utils/prisma.ts`
- [ ] **1.5** Executar `GET /orders` e analisar logs
- [ ] **1.5** Se confirmado N+1, implementar otimização

---

### 📅 **SEMANA 3 - MÉDIO** (Performance e Segurança)

#### Dia 1-3: Implementar Cache Redis
- [ ] **2.3** Instalar `ioredis @types/ioredis`
- [ ] **2.3** Criar `src/config/redis.ts`
- [ ] **2.3** Adicionar variável `REDIS_URL` no `.env`
- [ ] **2.3** Implementar cache em `products.service.ts` (`getProducts`, `getProductById`)
- [ ] **2.3** Implementar cache em `categories.service.ts` (`getCategories`, `getCategoryById`)
- [ ] **2.3** Adicionar invalidação de cache em operações de criação/atualização/deleção
- [ ] **2.3** Testar cache com requisições repetidas

#### Dia 4-5: Melhorias Gerais
- [ ] **4.2** Instalar `@fastify/compress`
- [ ] **4.2** Configurar compressão em `app.ts`
- [ ] **3.2** Configurar HTTPS/HSTS para produção
- [ ] **3.3** Configurar serializers de log para ocultar dados sensíveis
- [ ] **3.4** Adicionar validação `.trim()` e `.max()` em strings do Zod
- [ ] **3.6** Adicionar `.max()` em arrays (`colors`, `images`, `sizes`)

---

### 📅 **SEMANA 4 - MANUTENIBILIDADE** (Qualidade de Código)

#### Dia 1-2: Corrigir Tipos TypeScript
- [ ] **5.1** Substituir `any` por `Prisma.ProductWhereInput` em `products.service.ts`
- [ ] **5.1** Substituir `any` por `Prisma.CategoryWhereInput` em `categories.service.ts`
- [ ] **5.1** Substituir `any` por `Prisma.OrderWhereInput` em `orders.service.ts`
- [ ] **5.1** Substituir `as any` por `as Prisma.JsonObject` em campos JSON
- [ ] **5.6** Criar `src/config/env.ts` com validação Zod de variáveis de ambiente
- [ ] **5.6** Substituir `process.env` por imports de `env` em toda aplicação

#### Dia 3: Refatorar Duplicação
- [ ] **5.2** Criar `src/utils/slug.ts` com função `generateSlug`
- [ ] **5.2** Refatorar `products.controller.ts` para usar `generateSlug`
- [ ] **5.2** Refatorar `categories.controller.ts` para usar `generateSlug`
- [ ] **5.3** Substituir `console.error` por `fastify.log.error` em controllers

#### Dia 4-5: Implementar Testes
- [ ] **5.4** Instalar `vitest @vitest/ui`
- [ ] **5.4** Configurar Vitest em `vitest.config.ts`
- [ ] **5.4** Criar `tests/auth.service.test.ts` (hash de senha)
- [ ] **5.4** Criar `tests/products.service.test.ts` (filtros, paginação)
- [ ] **5.4** Criar `tests/orders.service.test.ts` (validação de estoque)
- [ ] **5.4** Criar `tests/validators.test.ts` (validação Zod)
- [ ] **5.4** Executar `npm test` e garantir 100% de aprovação

---

### 📅 **BACKLOG** (Melhorias Futuras)

#### Performance Avançada
- [ ] **4.1** Implementar cursor-based pagination
- [ ] **2.3** Configurar Redis em produção (Redis Cloud, Upstash ou ElastiCache)
- [ ] Implementar CDN para assets estáticos

#### Manutenibilidade Avançada
- [ ] **5.5** Refatorar `error.middleware.ts` com tratamento específico de erros
- [ ] **5.7** Instalar `fastify-zod` e unificar schemas
- [ ] Adicionar JSDoc em funções complexas
- [ ] Configurar ESLint + Prettier

#### Infraestrutura
- [ ] Configurar CI/CD (GitHub Actions)
- [ ] Adicionar scan de secrets (trufflehog)
- [ ] Configurar HTTPS com Let's Encrypt
- [ ] Implementar healthcheck em `/health`
- [ ] Adicionar APM (Sentry, DataDog ou New Relic)
- [ ] Configurar alertas para rate limit atingido, queries lentas (>100ms) e erros 5xx

#### Segurança Avançada
- [ ] Implementar rotação automática de JWT_SECRET
- [ ] Adicionar 2FA (Two-Factor Authentication)
- [ ] Implementar CAPTCHA em `/auth/register` e `/auth/signin`
- [ ] Configurar Web Application Firewall (WAF)

---

## 📊 RESUMO DE IMPACTO

### Por Severidade

| Severidade | Quantidade | % do Total |
|-----------|-----------|-----------|
| 🔴 Crítica | 5 | 16.7% |
| 🟠 Alta | 6 | 20.0% |
| 🟡 Média | 15 | 50.0% |
| 🟢 Baixa | 4 | 13.3% |
| **TOTAL** | **30** | **100%** |

### Por Categoria

| Categoria | Crítico | Alto | Médio | Baixo | Total |
|-----------|---------|------|-------|-------|-------|
| Segurança | 3 | 3 | 6 | 2 | 14 |
| Performance | 2 | 3 | 2 | 0 | 7 |
| Manutenibilidade | 0 | 0 | 7 | 2 | 9 |
| **TOTAL** | **5** | **6** | **15** | **4** | **30** |

---

## ✅ BOAS PRÁTICAS JÁ IMPLEMENTADAS

- ✅ Uso de Prisma ORM (mitiga SQL Injection)
- ✅ Validação com Zod
- ✅ Soft deletes (campos `active`)
- ✅ Queries paralelas com `Promise.all`
- ✅ Transações atômicas em `createOrder`
- ✅ Helmet e CORS configurados (mas precisam ajustes)
- ✅ Documentação OpenAPI/Swagger

---

## 🚨 ATENÇÃO - CHECKLIST PRÉ-DEPLOY

Antes de fazer deploy em produção, **OBRIGATORIAMENTE** verificar:

- [ ] ✅ Credenciais rotacionadas (DATABASE_URL, JWT_SECRET)
- [ ] ✅ Autenticação descomentada em todas as rotas
- [ ] ✅ Rate limiting ativo
- [ ] ✅ CORS restrito a domínios autorizados
- [ ] ✅ Índices criados no banco de dados
- [ ] ✅ HTTPS configurado
- [ ] ✅ Logs não expõem dados sensíveis
- [ ] ✅ Testes passando (cobertura mínima 80%)
- [ ] ✅ `npm audit` sem vulnerabilidades críticas
- [ ] ✅ Variáveis de ambiente validadas
- [ ] ✅ Healthcheck endpoint funcionando

---

**Última atualização:** 01 de setembro de 2026  
**Responsável:** Equipe de Desenvolvimento Syntax Wear  
**Revisão necessária:** A cada sprint (2 semanas)
