import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const categories = [
  {
    name: 'Camisetas',
    slug: 'camisetas',
    description: 'Camisetas casuais e confortáveis para o dia a dia',
    active: true,
  },
  {
    name: 'Moletons',
    slug: 'moletons',
    description: 'Moletons quentes e estilosos',
    active: true,
  },
  {
    name: 'Calças',
    slug: 'calcas',
    description: 'Calças e jeans para todas as ocasiões',
    active: true,
  },
  {
    name: 'Shorts',
    slug: 'shorts',
    description: 'Shorts esportivos e casuais',
    active: true,
  },
  {
    name: 'Acessórios',
    slug: 'acessorios',
    description: 'Cintos, bonés, mochilas e mais',
    active: true,
  },
  {
    name: 'Vestidos',
    slug: 'vestidos',
    description: 'Vestidos para diversas ocasiões',
    active: true,
  },
  {
    name: 'Calçados',
    slug: 'calcados',
    description: 'Tênis, sapatos e sandálias',
    active: true,
  },
  {
    name: 'Meias',
    slug: 'meias',
    description: 'Meias confortáveis em diversos estilos',
    active: true,
  },
]

const products = [
  {
    name: 'Classic Tee',
    slug: 'classic-tee',
    description: 'Camiseta clássica, confortável e versátil.',
    price: '29.99',
    colors: ['Black', 'White'],
    images: ['https://placehold.co/600x400?text=classic-tee+1', 'https://placehold.co/600x400?text=classic-tee+2'],
    sizes: ['S', 'M', 'L'],
    stock: 120,
    active: true,
  },
  {
    name: 'Vintage Hoodie',
    slug: 'vintage-hoodie',
    description: 'Moletom estilo vintage com caimento oversized.',
    price: '59.90',
    colors: ['Gray', 'Navy'],
    images: ['https://placehold.co/600x400?text=vintage-hoodie+1'],
    sizes: ['M', 'L', 'XL'],
    stock: 60,
    active: true,
  },
  {
    name: 'Slim Jeans',
    slug: 'slim-jeans',
    description: 'Jeans slim fit, tecido stretch para maior conforto.',
    price: '79.50',
    colors: ['Blue'],
    images: ['https://placehold.co/600x400?text=slim-jeans+1'],
    sizes: ['30', '32', '34', '36'],
    stock: 40,
    active: true,
  },
  {
    name: 'Sport Shorts',
    slug: 'sport-shorts',
    description: 'Shorts esportivo, ideal para treinos.',
    price: '24.00',
    colors: ['Black', 'Green'],
    images: ['https://placehold.co/600x400?text=sport-shorts+1'],
    sizes: ['S', 'M', 'L'],
    stock: 200,
    active: true,
  },
  {
    name: 'Leather Belt',
    slug: 'leather-belt',
    description: 'Cinto de couro legítimo com fivela metálica.',
    price: '19.99',
    colors: ['Brown', 'Black'],
    images: ['https://placehold.co/600x400?text=leather-belt+1'],
    sizes: ['M', 'L'],
    stock: 80,
    active: true,
  },
  {
    name: 'Summer Dress',
    slug: 'summer-dress',
    description: 'Vestido leve para dias quentes.',
    price: '49.00',
    colors: ['Yellow', 'White'],
    images: ['https://placehold.co/600x400?text=summer-dress+1'],
    sizes: ['S', 'M', 'L'],
    stock: 30,
    active: true,
  },
  {
    name: 'Running Shoes',
    slug: 'running-shoes',
    description: 'Tênis de corrida com amortecimento avançado.',
    price: '119.99',
    colors: ['Black', 'Red'],
    images: ['https://placehold.co/600x400?text=running-shoes+1'],
    sizes: ['40', '41', '42', '43'],
    stock: 75,
    active: true,
  },
  {
    name: 'Beanie Cap',
    slug: 'beanie-cap',
    description: 'Gorro em malha, estilo urbano.',
    price: '12.50',
    colors: ['Black', 'Gray'],
    images: ['https://placehold.co/600x400?text=beanie-cap+1'],
    sizes: [],
    stock: 150,
    active: true,
  },
  {
    name: 'Canvas Backpack',
    slug: 'canvas-backpack',
    description: 'Mochila de lona com múltiplos compartimentos.',
    price: '69.00',
    colors: ['Olive', 'Black'],
    images: ['https://placehold.co/600x400?text=canvas-backpack+1'],
    sizes: [],
    stock: 45,
    active: true,
  },
  {
    name: 'Striped Socks',
    slug: 'striped-socks',
    description: 'Meias listradas em algodão macio.',
    price: '6.99',
    colors: ['White', 'Blue'],
    images: ['https://placehold.co/600x400?text=striped-socks+1'],
    sizes: ['One Size'],
    stock: 300,
    active: true,
  },
]

async function main() {
  try {
    await prisma.product.deleteMany({})
    await prisma.category.deleteMany({})
    console.log('🗑️  Dados antigos removidos')

    const createdCategories = await prisma.category.createMany({ data: categories })
    console.log(`✅ ${createdCategories.count} categorias criadas`)

    const camisetas = await prisma.category.findUnique({ where: { slug: 'camisetas' } })
    const moletons = await prisma.category.findUnique({ where: { slug: 'moletons' } })
    const calcas = await prisma.category.findUnique({ where: { slug: 'calcas' } })
    const shorts = await prisma.category.findUnique({ where: { slug: 'shorts' } })
    const acessorios = await prisma.category.findUnique({ where: { slug: 'acessorios' } })
    const vestidos = await prisma.category.findUnique({ where: { slug: 'vestidos' } })
    const calcados = await prisma.category.findUnique({ where: { slug: 'calcados' } })
    const meias = await prisma.category.findUnique({ where: { slug: 'meias' } })

    const productsWithCategory = [
      { ...products[0], categoryId: camisetas!.id },      // Classic Tee
      { ...products[1], categoryId: moletons!.id },       // Vintage Hoodie
      { ...products[2], categoryId: calcas!.id },         // Slim Jeans
      { ...products[3], categoryId: shorts!.id },         // Sport Shorts
      { ...products[4], categoryId: acessorios!.id },     // Leather Belt
      { ...products[5], categoryId: vestidos!.id },       // Summer Dress
      { ...products[6], categoryId: calcados!.id },       // Running Shoes
      { ...products[7], categoryId: acessorios!.id },     // Beanie Cap
      { ...products[8], categoryId: acessorios!.id },     // Canvas Backpack
      { ...products[9], categoryId: meias!.id },          // Striped Socks
    ]

    const createdProducts = await prisma.product.createMany({ data: productsWithCategory })
    console.log(`✅ ${createdProducts.count} produtos criados com categorias vinculadas`)
    
    console.log('🎉 Seed finalizado com sucesso!')
  } catch (error) {
    console.error('❌ Erro no seed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
