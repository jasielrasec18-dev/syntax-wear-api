import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const products = [
  {
    name: "Camiseta Essential Preta",
    slug: "camiseta-essential-preta",
    description: "Camiseta minimalista de algodao premium para o dia a dia.",
    price: 89.9,
    colors: ["preto"],
    images: ["/uploads/camiseta-essential-preta.jpg"],
    sizes: ["P", "M", "G", "GG"],
    stock: 35,
  },
  {
    name: "Camiseta Oversized Off White",
    slug: "camiseta-oversized-off-white",
    description: "Modelagem oversized com toque macio e caimento estruturado.",
    price: 119.9,
    colors: ["off-white"],
    images: ["/uploads/camiseta-oversized-off-white.jpg"],
    sizes: ["P", "M", "G", "GG"],
    stock: 28,
  },
  {
    name: "Moletom Logo Grafite",
    slug: "moletom-logo-grafite",
    description: "Moletom confortavel com capuz e logo bordado no peito.",
    price: 229.9,
    colors: ["grafite"],
    images: ["/uploads/moletom-logo-grafite.jpg"],
    sizes: ["P", "M", "G", "GG"],
    stock: 18,
  },
  {
    name: "Calca Cargo Urban",
    slug: "calca-cargo-urban",
    description:
      "Calca cargo resistente com bolsos funcionais e corte moderno.",
    price: 249.9,
    colors: ["preto", "verde militar"],
    images: ["/uploads/calca-cargo-urban.jpg"],
    sizes: ["38", "40", "42", "44"],
    stock: 22,
  },
  {
    name: "Jaqueta Bomber Nylon",
    slug: "jaqueta-bomber-nylon",
    description:
      "Jaqueta bomber leve para compor looks urbanos em qualquer estacao.",
    price: 299.9,
    colors: ["preto", "azul marinho"],
    images: ["/uploads/jaqueta-bomber-nylon.jpg"],
    sizes: ["P", "M", "G", "GG"],
    stock: 14,
  },
  {
    name: "Bone Dad Hat Syntax",
    slug: "bone-dad-hat-syntax",
    description: "Bone de aba curva com ajuste traseiro e bordado frontal.",
    price: 79.9,
    colors: ["preto", "bege"],
    images: ["/uploads/bone-dad-hat-syntax.jpg"],
    sizes: ["unico"],
    stock: 40,
  },
  {
    name: "Camiseta Graphic Code",
    slug: "camiseta-graphic-code",
    description:
      "Camiseta de algodao com estampa exclusiva inspirada em codigo.",
    price: 109.9,
    colors: ["branco"],
    images: ["/uploads/camiseta-graphic-code.jpg"],
    sizes: ["P", "M", "G", "GG"],
    stock: 26,
  },
  {
    name: "Shorts Tech Fleece",
    slug: "shorts-tech-fleece",
    description: "Shorts de fleece com cordao ajustavel e bolsos laterais.",
    price: 139.9,
    colors: ["cinza", "preto"],
    images: ["/uploads/shorts-tech-fleece.jpg"],
    sizes: ["P", "M", "G", "GG"],
    stock: 31,
  },
  {
    name: "Meias Mid Crew Pack",
    slug: "meias-mid-crew-pack",
    description: "Kit com tres pares de meias cano medio para uso diario.",
    price: 49.9,
    colors: ["branco", "preto"],
    images: ["/uploads/meias-mid-crew-pack.jpg"],
    sizes: ["unico"],
    stock: 60,
  },
  {
    name: "Shoulder Bag Utility",
    slug: "shoulder-bag-utility",
    description:
      "Bolsa compacta transversal para carregar seus itens essenciais.",
    price: 129.9,
    colors: ["preto"],
    images: ["/uploads/shoulder-bag-utility.jpg"],
    sizes: ["unico"],
    stock: 20,
  },
];

async function main() {
  try {
    const res = await prisma.product.createMany({ data: products, skipDuplicates: true })
    console.log(`✅ Seed finalizado: ${res.count} produtos inseridos (skipDuplicates: true)`)
  } catch (error) {
    console.error('❌ Erro no seed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()