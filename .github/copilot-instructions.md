# Copilot Instructions - Syntax Wear API

## Visão Geral do Projeto

API REST em **Node.js + Fastify + TypeScript** para o e-commerce Syntax Wear. Stack: Fastify, Prisma ORM, PostgreSQL (Supabase), JWT auth, Zod validation. Arquitetura em camadas: routes → controllers → services → Prisma.

## Arquitetura e Padrões

### Estrutura de Camadas (Obrigatória)
```
routes/       → Registro de rotas + schemas OpenAPI (Fastify schema)
controllers/  → Validação Zod + chamada de serviços + resposta HTTP
services/     → Lógica de negócio + acesso ao Prisma
```

**Exemplo de fluxo completo:**
- `auth.routes.ts` registra POST /auth/register com schema OpenAPI
- `auth.controller.ts` valida body com `registerSchema` (Zod), chama `registerUser`, retorna JWT
- `auth.service.ts` verifica email único, hash bcrypt, cria user no Prisma

### Validação com Zod
- **SEMPRE** use Zod schemas em `utils/validators.ts` nos controllers
- Parse com `.parse()` (lança ZodError capturado pelo error handler)
- Exemplo: `registerSchema.parse(request.body as RegisterRequest)`

### Convenções de Código

**Slugs automáticos:**
```typescript
body.slug = slugify(body.name, { lower: true, strict: true, locale: "pt" });
```

**Soft deletes:** Use `active: false` em vez de deletar registros (ver `products.service.ts:deleteProduct`)

**Erros em serviços:** Lance `throw new Error("Mensagem em português")` - error handler global captura

**Paginação padrão:** `page=1, limit=10` (ver `products.service.ts:getProducts`)

**Filtros Prisma:** Use `where.OR` para busca multi-campo, `mode: "insensitive"` para case-insensitive

## Configuração e Desenvolvimento

### Comandos Essenciais
```bash
npm run dev              # Dev server com tsx watch
npm run prisma:migrate   # Aplicar migrations (cria nova migration)
npm run prisma:studio    # UI visual do banco de dados
npm run prisma:seed      # Popular banco com dados iniciais
```

### Autenticação JWT
- Secret em `process.env.JWT_SECRET`
- Middleware `authenticate` em `middlewares/auth.middleware.ts` usa `request.jwtVerify()`
- Token gerado via `request.server.jwt.sign({ userId })`
- Aplicar com `fastify.addHook("onRequest", authenticate)` nas rotas protegidas

### Prisma Schema Atual
- **User**: Role enum (USER/ADMIN), cpf/phone opcionais, bcrypt password hash
- **Product**: colors/sizes/images como Json, slug único, soft delete via `active`
- **Order/OrderItem**: shippingAddress como Json, status default "pending", OrderItem tem size opcional
- **Sem Category atual no schema** (mencionado no PRD mas não implementado ainda)

## Integrações Planejadas

### Supabase (docs/PRD-backend.md)
- **Storage:** Upload de imagens de produto (gravar URLs em `Product.images`)
- **CEP:** Integrar viaCEP em POST /shipping/calc para calcular frete
- **Newsletter:** Criar model Subscription (email único)

### Pagamentos
- Criar Order com `status: "pending"`, integrar gateway (Stripe/Pagar.me), webhook atualiza para "paid"

## Testes (Planejado - Vitest)
- **Unit:** Validação CPF, cálculo de totais, filtros/paginação
- **Integration:** Auth endpoints, GET/POST products, POST orders (mock gateway)

## OpenAPI/Swagger
- Docs em `http://localhost:3000/api-docs` (Scalar UI)
- Schemas inline em routes com tags, description, body, response, security
- Exemplo em `products.routes.ts` e `auth.routes.ts`

## Problemas Comuns

**"Token inválido ou expirado":** Verificar `JWT_SECRET` no `.env` e presença do header `Authorization: Bearer <token>`

**Slug duplicado:** Auto-gerado via slugify do `name`, mas pode conflitar - adicionar sufixo numérico se necessário

**Zod vs Fastify validation:** Preferir Zod em controllers; Fastify schema é só para documentação OpenAPI

**Decimal vs Number:** Prisma retorna `Decimal` para price/total - converter com `Number()` ou usar métodos do `decimal.js`

## Próximos Passos (Roadmap)
1. Implementar model Category e relacionamento Product.categoryId
2. Admin CRUD para categorias e usuários
3. POST /orders com validação de stock (transacional)
4. Upload de imagens para Supabase Storage
5. Endpoint POST /shipping/calc (viaCEP integration)
6. Testes com Vitest
