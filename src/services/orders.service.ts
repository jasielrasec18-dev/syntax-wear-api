import { OrderFilters, CreateOrder, UpdateOrder } from '../types'
import { prisma } from '../utils/prisma'

export async function getOrders(filters: OrderFilters = {}) {
  const page = filters.page || 1
  const limit = filters.limit || 10
  const skip = (page - 1) * limit

  const where: any = {}

  if (filters.status) {
    where.status = filters.status
  }

  if (filters.userId) {
    where.userId = filters.userId
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {}
    if (filters.startDate) {
      where.createdAt.gte = new Date(filters.startDate)
    }
    if (filters.endDate) {
      where.createdAt.lte = new Date(filters.endDate)
    }
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    }),
    prisma.order.count({ where }),
  ])

  return {
    data: orders,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

export async function getOrderById(id: number) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          cpf: true,
          phone: true,
        },
      },
      items: {
        include: {
          product: {
            include: {
              category: true,
            },
          },
        },
      },
    },
  })

  if (!order) {
    throw new Error('Pedido não encontrado')
  }

  return order
}

export async function createOrder(data: CreateOrder) {
  const productIds = data.items.map(item => item.productId)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { category: true },
  })

  if (products.length !== productIds.length) {
    const foundIds = products.map(p => p.id)
    const missingIds = productIds.filter(id => !foundIds.includes(id))
    throw new Error(`Produto(s) com ID ${missingIds.join(', ')} não encontrado(s)`)
  }

  const productMap = new Map(products.map(p => [p.id, p]))

  let calculatedTotal = 0

  for (const item of data.items) {
    const product = productMap.get(item.productId)!

    if (!product.active) {
      throw new Error(`Produto ${product.name} está inativo`)
    }

    if (product.stock < item.quantity) {
      throw new Error(
        `Estoque insuficiente para ${product.name}. Disponível: ${product.stock}, solicitado: ${item.quantity}`
      )
    }

    const productSizes = (product.sizes as any) || []
    if (productSizes.length > 0) {
      if (!item.size) {
        throw new Error(`Produto ${product.name} requer seleção de tamanho`)
      }
      if (!productSizes.includes(item.size)) {
        throw new Error(`Tamanho ${item.size} não disponível para ${product.name}`)
      }
    }

    calculatedTotal += Number(product.price) * item.quantity
  }

  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        userId: data.userId,
        total: calculatedTotal,
        status: 'PENDING',
        shippingAddress: data.shippingAddress as any,
        paymentMethod: data.paymentMethod,
      },
    })

    await Promise.all(
      data.items.map(item => {
        const product = productMap.get(item.productId)!
        return tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.productId,
            price: product.price,
            quantity: item.quantity,
            size: item.size,
          },
        })
      })
    )

    await Promise.all(
      data.items.map(item =>
        tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        })
      )
    )

    return newOrder
  })

  return order
}

export async function updateOrder(id: number, data: UpdateOrder) {
  const existingOrder = await prisma.order.findUnique({
    where: { id },
  })

  if (!existingOrder) {
    throw new Error('Pedido não encontrado')
  }

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: {
      status: data.status,
      shippingAddress: data.shippingAddress as any,
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          cpf: true,
          phone: true,
        },
      },
      items: {
        include: {
          product: {
            include: {
              category: true,
            },
          },
        },
      },
    },
  })

  return updatedOrder
}

export async function cancelOrder(id: number) {
  const existingOrder = await prisma.order.findUnique({
    where: { id },
  })

  if (!existingOrder) {
    throw new Error('Pedido não encontrado')
  }

  if (existingOrder.status === 'CANCELLED') {
    throw new Error('Pedido já está cancelado')
  }

  if (existingOrder.status === 'DELIVERED') {
    throw new Error('Não é possível cancelar um pedido já entregue')
  }

  const cancelledOrder = await prisma.order.update({
    where: { id },
    data: { status: 'CANCELLED' },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      items: {
        include: {
          product: {
            include: {
              category: true,
            },
          },
        },
      },
    },
  })

  return cancelledOrder
}
