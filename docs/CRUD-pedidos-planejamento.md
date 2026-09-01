# Planejamento: CRUD de Pedidos (Orders) com Integração de Produtos

**Data:** 1 de setembro de 2026  
**Status:** Planejamento

## Objetivo

Implementação completa de CRUD de pedidos (Orders e OrderItems) seguindo a arquitetura em 3 camadas (routes → controllers → services → Prisma) estabelecida no projeto, com controle transacional de estoque e validações rigorosas.

---

## Decisões Arquiteturais

1. **Status de pedido**: Enum ("PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED") para garantir consistência
2. **Cancelamento de pedido**: NÃO implementar reversão de estoque (sem rollback)
3. **Webhook de pagamento**: NÃO implementar endpoint de confirmação de pagamento

---

## Etapa 1: Schema Prisma + Migration

### Arquivos a modificar:
- `prisma/schema.prisma`

### Tarefas:

1. **Criar enum OrderStatus:**
   ```prisma
   enum OrderStatus {
     PENDING
     PAID
     SHIPPED
     DELIVERED
     CANCELLED
   }
   ```

2. **Criar model Order:**
   ```prisma
   model Order {
     id              Int         @id @default(autoincrement())
     userId          Int?
     user            User?       @relation(fields: [userId], references: [id])
     total           Decimal
     status          OrderStatus @default(PENDING)
     shippingAddress Json
     paymentMethod   String
     createdAt       DateTime    @default(now())
     updatedAt       DateTime    @updatedAt
     items           OrderItem[]
   }
   ```

3. **Criar model OrderItem:**
   ```prisma
   model OrderItem {
     id        Int     @id @default(autoincrement())
     orderId   Int
     order     Order   @relation(fields: [orderId], references: [id])
     productId Int
     product   Product @relation(fields: [productId], references: [id])
     price     Decimal
     quantity  Int
     size      String?
     createdAt DateTime @default(now())
   }
   ```

4. **Atualizar model Product:**
   - Adicionar relação: `orderItems OrderItem[]`

5. **Atualizar model User:**
   - Adicionar relação: `orders Order[]`

6. **Executar migration:**
   ```bash
   npm run prisma:migrate
   ```
   - Nome sugerido: "add_order_and_order_item_models"

---

## Etapa 2: Service - Lógica de Negócio com Transações

### Arquivo a criar:
- `src/services/orders.service.ts`

### Funções em `orders.service.ts`:

1. **`getOrders(filters: OrderFilters)`**
   - Paginação opcional (page=1, limit=10)
   - Filtros: status, userId, startDate, endDate
   - Include: items (com product), user (opcional)
   - Ordenação: createdAt desc (mais recentes primeiro)
   - Retorna `{ data, total, page, limit, totalPages }`

2. **`getOrderById(id: number)`**
   - Buscar pedido por ID
   - Include: items (com product e category), user
   - Lançar erro se não encontrado: `throw new Error("Pedido não encontrado")`

3. **`createOrder(data: CreateOrder)`**
   - **Validações prévias:**
     - Verificar que todos os produtos existem
     - Verificar que todos os produtos estão ativos (`active: true`)
     - Verificar estoque disponível para cada item
     - Se produto tem sizes, validar que size foi informado e está na lista
   
   - **Cálculo de total:**
     - Para cada item: buscar `Product.price` atual
     - Total = Σ (price × quantity)
   
   - **Transação Prisma (`prisma.$transaction`):**
     ```typescript
     await prisma.$transaction(async (tx) => {
       // 1. Criar Order
       const order = await tx.order.create({
         data: {
           userId: data.userId,
           total: calculatedTotal,
           status: "PENDING",
           shippingAddress: data.shippingAddress,
           paymentMethod: data.paymentMethod,
         },
       });

       // 2. Criar OrderItems com snapshot de preço
       const orderItems = await Promise.all(
         data.items.map(item => 
           tx.orderItem.create({
             data: {
               orderId: order.id,
               productId: item.productId,
               price: productPriceSnapshot,
               quantity: item.quantity,
               size: item.size,
             },
           })
         )
       );

       // 3. Decrementar estoque de cada produto
       await Promise.all(
         data.items.map(item =>
           tx.product.update({
             where: { id: item.productId },
             data: { stock: { decrement: item.quantity } },
           })
         )
       );

       return order;
     });
     ```
   
   - **Erros a lançar:**
     - `"Produto {name} não encontrado"`
     - `"Produto {name} está inativo"`
     - `"Estoque insuficiente para {name}. Disponível: {stock}, solicitado: {quantity}"`
     - `"Produto {name} requer seleção de tamanho"`
     - `"Tamanho {size} não disponível para {name}"`

4. **`updateOrder(id: number, data: UpdateOrder)`**
   - Verificar se pedido existe
   - Permitir atualização de: status, shippingAddress
   - NÃO permitir alterar items após criação
   - Retornar pedido atualizado com includes

---

## Etapa 3: Controller - Validação e Resposta HTTP

### Arquivo a criar:
- `src/controllers/orders.controller.ts`

### Arquivos a modificar:
- `src/utils/validators.ts`
- `src/types/index.ts`

### Handlers em `orders.controller.ts`:

1. **`listOrders`** - GET /
   - Parse query com `orderFiltersSchema`
   - Chamar `getOrders(filters)`
   - Status 200

2. **`getOrder`** - GET /:id
   - Chamar `getOrderById(id)`
   - Status 200

3. **`createNewOrder`** - POST /
   - Parse body com `createOrderSchema`
   - Chamar `createOrder(data)`
   - Status 201
   - Response: `{ message: "Pedido criado com sucesso", orderId: order.id }`

4. **`updateExistingOrder`** - PUT /:id
   - Parse body com `updateOrderSchema`
   - Chamar `updateOrder(id, data)`
   - Status 200

### Zod schemas em `validators.ts`:

```typescript
export const orderFiltersSchema = z.object({
  page: z.coerce.number().int().min(1, "Página deve ser no mínimo 1").optional(),
  limit: z.coerce.number().int().min(1, "Limite deve ser no mínimo 1").optional(),
  status: z.enum(["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"]).optional(),
  userId: z.coerce.number().int().optional(),
  startDate: z.string().optional(), // ISO 8601
  endDate: z.string().optional(),   // ISO 8601
});

export const createOrderItemSchema = z.object({
  productId: z.number().int().min(1, "ID do produto inválido"),
  quantity: z.number().int().min(1, "Quantidade deve ser no mínimo 1"),
  size: z.string().optional(),
});

export const createOrderSchema = z.object({
  userId: z.number().int().optional(),
  items: z.array(createOrderItemSchema).min(1, "Pedido deve ter pelo menos um item"),
  shippingAddress: z.object({
    cep: z.string().regex(/^\d{8}$/, "CEP deve ter 8 dígitos"),
    street: z.string().min(1, "Rua é obrigatória"),
    number: z.string().min(1, "Número é obrigatório"),
    complement: z.string().optional(),
    neighborhood: z.string().min(1, "Bairro é obrigatório"),
    city: z.string().min(1, "Cidade é obrigatória"),
    state: z.string().length(2, "Estado deve ter 2 caracteres"),
    country: z.string().default("BR"),
  }),
  paymentMethod: z.string().min(1, "Método de pagamento é obrigatório"),
});

export const updateOrderSchema = z.object({
  status: z.enum(["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"]).optional(),
  shippingAddress: z.object({
    cep: z.string().regex(/^\d{8}$/, "CEP deve ter 8 dígitos"),
    street: z.string().min(1, "Rua é obrigatória"),
    number: z.string().min(1, "Número é obrigatório"),
    complement: z.string().optional(),
    neighborhood: z.string().min(1, "Bairro é obrigatório"),
    city: z.string().min(1, "Cidade é obrigatória"),
    state: z.string().length(2, "Estado deve ter 2 caracteres"),
    country: z.string().default("BR"),
  }).optional(),
});
```

### Tipos em `types/index.ts`:

```typescript
export interface OrderFilters {
  page?: number;
  limit?: number;
  status?: "PENDING" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  userId?: number;
  startDate?: string;
  endDate?: string;
}

export interface ShippingAddress {
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
}

export interface CreateOrderItem {
  productId: number;
  quantity: number;
  size?: string;
}

export interface CreateOrder {
  userId?: number;
  items: CreateOrderItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: string;
}

export interface UpdateOrder {
  status?: "PENDING" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  shippingAddress?: ShippingAddress;
}
```

---

## Etapa 4: Rotas - Registro e Documentação OpenAPI

### Arquivo a criar:
- `src/routes/orders.routes.ts`

### Arquivo a modificar:
- `src/app.ts`

### Endpoints em `orders.routes.ts`:

Todas as rotas protegidas com `fastify.addHook("onRequest", authenticate)`

1. **GET /** - Listar pedidos com filtros
   - Query: page?, limit?, status?, userId?, startDate?, endDate?
   - Schema OpenAPI com tags: ["Orders"]
   - Response: objeto com data, total, page, limit, totalPages

2. **GET /:id** - Obter pedido por ID
   - Params: id (number)
   - Response: pedido com items (incluindo product) e user

3. **POST /** - Criar novo pedido
   - Body: userId?, items[], shippingAddress, paymentMethod
   - Validações: items não vazio, CEP válido, quantities >= 1
   - Response 201: `{ message, orderId }`

4. **PUT /:id** - Atualizar pedido
   - Params: id
   - Body: status?, shippingAddress?
   - Response 200: pedido atualizado

### Schemas OpenAPI:
- Todas com `security: [{ bearerAuth: [] }]`
- Tags: `["Orders"]`
- Description detalhada
- Response schemas: 200, 201, 400, 401, 404, 500

### Registro em `app.ts`:

```typescript
import orderRoutes from "./routes/orders.routes";

// ...

fastify.register(orderRoutes, { prefix: "/orders" });
```

---

## Considerações Finais

### Controle de Estoque Transacional
- Usar `prisma.$transaction` para garantir atomicidade
- Decrementar stock apenas após validações bem-sucedidas
- Se qualquer operação falhar, toda a transação é revertida automaticamente

### Snapshot de Preço
- `OrderItem.price` armazena o preço do produto no momento da compra
- Evita inconsistências se `Product.price` mudar posteriormente
- Cálculo do total usa este snapshot

### Validações Críticas
1. Produto existe e está ativo
2. Estoque suficiente disponível
3. Se produto tem sizes, validar que size foi informado e está disponível
4. CEP no formato correto (8 dígitos)
5. Items não vazio, quantities >= 1

### Guest Checkout
- `Order.userId` é opcional
- Permite criar pedidos sem usuário logado
- Útil para conversão de vendas sem forçar cadastro

### Status do Pedido
- **PENDING**: Criado, aguardando pagamento
- **PAID**: Pagamento confirmado
- **SHIPPED**: Enviado
- **DELIVERED**: Entregue
- **CANCELLED**: Cancelado (sem reversão de estoque)

### Filtros e Paginação
- Padrão: page=1, limit=10
- Ordenação: createdAt desc (mais recentes primeiro)
- Filtros por status, userId, range de datas

### NÃO Implementado (Fora do Escopo)
- ❌ Reversão de estoque ao cancelar pedido
- ❌ Webhook de confirmação de pagamento
- ❌ Cálculo de frete (integração viaCEP)
- ❌ Aplicação de cupons de desconto
- ❌ Exclusão de pedidos (apenas update de status)

---

## Padrões do Projeto a Seguir

- Mensagens de erro em português
- Validação Zod em controllers
- Paginação padrão: page=1, limit=10
- Error handler global captura ZodError e erros de serviço
- Includes nas relações para retornar dados completos
- Status HTTP apropriados: 200 (GET/PUT), 201 (POST), 400 (validação), 404 (não encontrado)

---

## Ordem de Implementação

1. ⏳ Schema + Migration (Order, OrderItem, enum OrderStatus)
2. ⏳ Service (orders.service.ts com transações Prisma)
3. ⏳ Validators + Types (Zod schemas e interfaces TypeScript)
4. ⏳ Controller (orders.controller.ts)
5. ⏳ Routes + Registro em app.ts
6. ⏳ Atualizar copilot-instructions.md
7. ⏳ Testar endpoints via Swagger (http://localhost:3000/api-docs)

---

## Exemplos de Uso

### Criar Pedido (POST /orders)
```json
{
  "userId": 1,
  "items": [
    {
      "productId": 5,
      "quantity": 2,
      "size": "M"
    },
    {
      "productId": 8,
      "quantity": 1
    }
  ],
  "shippingAddress": {
    "cep": "01310100",
    "street": "Av. Paulista",
    "number": "1578",
    "complement": "Apto 101",
    "neighborhood": "Bela Vista",
    "city": "São Paulo",
    "state": "SP",
    "country": "BR"
  },
  "paymentMethod": "credit_card"
}
```

### Atualizar Status (PUT /orders/1)
```json
{
  "status": "PAID"
}
```

### Listar Pedidos (GET /orders?status=PENDING&page=1&limit=10)
Response:
```json
{
  "data": [...],
  "total": 25,
  "page": 1,
  "limit": 10,
  "totalPages": 3
}
```
