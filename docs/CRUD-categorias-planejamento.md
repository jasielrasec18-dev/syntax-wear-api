# Planejamento: CRUD de Categorias com Vinculação a Produtos

**Data:** 1 de dezembro de 2025  
**Status:** Planejamento

## Objetivo

Implementação completa de CRUD de categorias seguindo a arquitetura em 3 camadas (routes → controllers → services) estabelecida no projeto, com vinculação obrigatória ao modelo Product e cascata de soft delete.

---

## Etapa 1: Schema Prisma + Migration + Atualização do Banco

### Arquivos a modificar:
- `prisma/schema.prisma`
- `prisma/seed.ts`

### Tarefas:

1. **Criar model Category em `schema.prisma`:**
   ```prisma
   model Category {
     id          Int       @id @default(autoincrement())
     name        String
     slug        String    @unique
     description String?
     active      Boolean   @default(true)
     createdAt   DateTime  @default(now())
     updatedAt   DateTime  @updatedAt
     products    Product[]
   }
   ```

2. **Atualizar model Product em `schema.prisma`:**
   - Adicionar campo `categoryId` (Int, **obrigatório**)
   - Adicionar relação `category Category @relation(fields: [categoryId], references: [id])`

3. **Executar migration:**
   ```bash
   npm run prisma:migrate
   ```
   - Nome sugerido: "add_category_relation_to_products"

4. **Atualizar `prisma/seed.ts`:**
   - Criar categorias de exemplo (ex: "Camisetas", "Moletons", "Acessórios")
   - Recriar produtos com `categoryId` válido ou deletar produtos existentes e popular do zero

---

## Etapa 2: Service - Lógica de Negócio

### Arquivo a criar:
- `src/services/categories.service.ts`

### Arquivo a modificar:
- `src/services/products.service.ts`

### Funções em `categories.service.ts`:

1. **`getCategories(filters: CategoryFilters)`**
   - Paginação opcional (page, limit)
   - Filtro por `active: true`
   - Busca por `name` com `mode: "insensitive"`
   - Retorna `{ data, total, page, limit, totalPages }`

2. **`getCategoryById(id: number)`**
   - Buscar categoria por ID
   - Lançar erro se não encontrada: `throw new Error("Categoria não encontrada")`

3. **`createCategory(data: CreateCategory)`**
   - Gerar slug via `slugify(data.name, { lower: true, strict: true, locale: "pt" })`
   - Verificar unicidade de slug
   - Lançar erro se slug já existe: `throw new Error("Slug já existe. Escolha outro nome para a categoria.")`
   - Criar via `prisma.category.create({ data })`

4. **`updateCategory(id: number, data: UpdateCategory)`**
   - Verificar se categoria existe
   - Se `data.name` fornecido, gerar novo slug
   - Validar slug único (exceto próprio ID)
   - Atualizar via `prisma.category.update({ where: { id }, data })`

5. **`deleteCategory(id: number)`**
   - Verificar se categoria existe
   - **Cascata de soft delete**: `prisma.product.updateMany({ where: { categoryId: id }, data: { active: false } })`
   - Desativar categoria: `prisma.category.update({ where: { id }, data: { active: false } })`

### Modificações em `products.service.ts`:

- **Função `getProducts`**: Adicionar suporte para filtro `categoryId` no objeto `where`
  ```typescript
  if (filter.categoryId) {
    where.categoryId = filter.categoryId;
  }
  ```

---

## Etapa 3: Controller - Validação e Resposta HTTP

### Arquivo a criar:
- `src/controllers/categories.controller.ts`

### Arquivos a modificar:
- `src/utils/validators.ts`
- `src/types/index.ts`

### Handlers em `categories.controller.ts`:

1. **`listCategories`** - GET /
2. **`getCategory`** - GET /:id
3. **`createNewCategory`** - POST /
   - Gerar slug automático antes de validar
4. **`updateExistingCategory`** - PUT /:id
   - Gerar slug automático se `name` fornecido
5. **`deleteExistingCategory`** - DELETE /:id

### Zod schemas em `validators.ts`:

```typescript
export const createCategorySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  slug: z.string().min(1, "Slug é obrigatório"),
  active: z.boolean(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").optional(),
  description: z.string().optional(),
  slug: z.string().min(1, "Slug é obrigatório").optional(),
  active: z.boolean().optional(),
});

export const categoryFiltersSchema = z.object({
  page: z.coerce.number().int().min(1, "Página deve ser no mínimo 1").optional(),
  limit: z.coerce.number().int().min(1, "Limite deve ser no mínimo 1").optional(),
  search: z.string().optional(),
});
```

### Atualizar `productFiltersSchema`:
```typescript
export const productFiltersSchema = z.object({
  // ... campos existentes
  categoryId: z.coerce.number().int().optional(),
});
```

### Tipos em `types/index.ts`:

```typescript
export interface CategoryFilters {
  page?: number;
  limit?: number;
  search?: string;
}

export interface CreateCategory {
  name: string;
  description?: string;
  slug: string;
  active: boolean;
}

export interface UpdateCategory extends Partial<CreateCategory> {
  name?: string;
  description?: string;
  slug?: string;
  active?: boolean;
}

// Atualizar ProductFilters
export interface ProductFilters {
  // ... campos existentes
  categoryId?: number;
}
```

---

## Etapa 4: Rotas - Registro e Documentação OpenAPI

### Arquivo a criar:
- `src/routes/categories.routes.ts`

### Arquivo a modificar:
- `src/app.ts`

### Endpoints em `categories.routes.ts`:

Todas as rotas protegidas com `fastify.addHook("onRequest", authenticate)`

1. **GET /** - Listar categorias com filtros
   - Query: page?, limit?, search?
   - Schema OpenAPI com tags: ["Categories"]

2. **GET /:id** - Obter categoria por ID
   - Params: id (number)

3. **POST /** - Criar nova categoria
   - Body: name, description?, active
   - Slug gerado automaticamente no controller

4. **PUT /:id** - Atualizar categoria
   - Params: id
   - Body: name?, description?, active?

5. **DELETE /:id** - Deletar categoria (soft delete + cascata)
   - Params: id

### Schemas OpenAPI:
- Todas com `security: [{ bearerAuth: [] }]`
- Tags: `["Categories"]`
- Description detalhada
- Response schemas: 200, 201, 400, 401, 404, 500

### Registro em `app.ts`:

```typescript
import categoryRoutes from "./routes/categories.routes";

// ...

fastify.register(categoryRoutes, { prefix: "/categories" });
```

---

## Considerações Finais

### Soft Delete em Cascata
Quando uma categoria é desativada via `deleteCategory`:
1. Todos os produtos relacionados são desativados: `prisma.product.updateMany({ where: { categoryId }, data: { active: false } })`
2. A categoria é desativada: `prisma.category.update({ where: { id }, data: { active: false } })`

### Filtro por Categoria em Produtos
GET /products?categoryId=1 será suportado após modificação em `products.service.ts`

### Seed
Recriar produtos com `categoryId` válido ou deletar todos e popular do zero com categorias vinculadas

### Padrões do Projeto
- Mensagens de erro em português
- Soft delete via `active: false`
- Slugs automáticos via slugify com locale "pt"
- Validação Zod em controllers
- Paginação padrão: page=1, limit=10
- Error handler global captura ZodError e erros de serviço

---

## Ordem de Implementação

1. ✅ Planejar (este documento)
2. ⏳ Schema + Migration + Seed
3. ⏳ Service (categories + atualizar products)
4. ⏳ Controller + Validators + Types
5. ⏳ Routes + Registro em app.ts
6. ⏳ Testar endpoints via Swagger (http://localhost:3000/api-docs)
