const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs'); // npm install bcryptjs

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const hashedPassword = await bcrypt.hash('Password123!', 10);

  // ─────────────────────────────────────────────────────────────────────────
  // SELLER 1 — Kwame Mensah  |  Store: TechHub Ghana
  // ─────────────────────────────────────────────────────────────────────────
  const seller1 = await prisma.user.upsert({
    where: { email: 'kwame.mensah@techhubghana.com' },
    update: {},
    create: {
      email: 'kwame.mensah@techhubghana.com',
      phone: '+233244000001',
      firstName: 'Kwame',
      lastName: 'Mensah',
      password: hashedPassword,
      role: 'SELLER',
      isVerified: true,
      verificationStatus: 'APPROVED',
      points: 120,
      payoutPreference: 'mobile_money',
    },
  });

  const store1 = await prisma.store.upsert({
    where: { url: 'techhub-ghana' },
    update: {},
    create: {
      userId: seller1.id,
      name: 'TechHub Ghana',
      url: 'techhub-ghana',
      description:
        'Your one-stop shop for the latest phones, laptops, accessories and electronics in Ghana. Genuine products, fast delivery.',
      logo: 'https://placehold.co/200x200?text=TechHub',
      location: 'Accra Mall, Spintex Road, Accra',
      category: 'Phones & Electronics',
      region: 'Greater Accra',
      isActive: true,
      rating: 4.7,
      totalReviews: 89,
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SELLER 2 — Ama Owusu  |  Store: Ama's Fashion House
  // ─────────────────────────────────────────────────────────────────────────
  const seller2 = await prisma.user.upsert({
    where: { email: 'ama.owusu@amasfashion.com' },
    update: {},
    create: {
      email: 'ama.owusu@amasfashion.com',
      phone: '+233244000002',
      firstName: 'Ama',
      lastName: 'Owusu',
      password: hashedPassword,
      role: 'SELLER',
      isVerified: true,
      verificationStatus: 'APPROVED',
      points: 85,
      payoutPreference: 'mobile_money',
    },
  });

  const store2 = await prisma.store.upsert({
    where: { url: 'amas-fashion-house' },
    update: {},
    create: {
      userId: seller2.id,
      name: "Ama's Fashion House",
      url: 'amas-fashion-house',
      description:
        'Trendy African and contemporary fashion for men and women. Kente fabric outfits, casual wear, and premium accessories.',
      logo: 'https://placehold.co/200x200?text=AmaFashion',
      location: 'Kumasi Central Market, Kumasi',
      category: 'Fashion',
      region: 'Ashanti',
      isActive: true,
      rating: 4.5,
      totalReviews: 62,
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PRODUCTS — 5 for TechHub Ghana, 5 for Ama's Fashion House
  // ─────────────────────────────────────────────────────────────────────────

  // Helper: generate a URL-safe slug with a tiny random suffix
  const slug = (base) =>
    `${base}-${Math.random().toString(36).slice(2, 7)}`;

  // ── TechHub Ghana Products ────────────────────────────────────────────────

  await prisma.product.create({
    data: {
      storeId: store1.id,
      name: 'Samsung Galaxy A55 5G',
      description:
        'Samsung Galaxy A55 5G with 8GB RAM, 256GB storage, 50MP triple camera, and 5000mAh battery. Comes with 1-year local warranty.',
      price: 3299.99,
      stock: 24,
      images: [
        'https://placehold.co/600x600?text=Galaxy+A55+Front',
        'https://placehold.co/600x600?text=Galaxy+A55+Back',
      ],
      category: 'Phones & Electronics',
      tags: ['samsung', 'android', '5g', 'smartphone'],
      sizes: [],
      color: ['Awesome Navy', 'Awesome Iceblue', 'Awesome Lilac'],
      quantityBought: 41,
      url: slug('samsung-galaxy-a55-5g'),
      isActive: true,
      rating: 5,
    },
  });

  await prisma.product.create({
    data: {
      storeId: store1.id,
      name: 'Apple iPhone 15 128GB',
      description:
        'Brand new sealed iPhone 15 with Dynamic Island, 48MP main camera, USB-C charging, and A16 Bionic chip. Ghana warranty included.',
      price: 7499.00,
      stock: 10,
      images: [
        'https://placehold.co/600x600?text=iPhone+15+Front',
        'https://placehold.co/600x600?text=iPhone+15+Back',
      ],
      category: 'Phones & Electronics',
      tags: ['apple', 'iphone', 'ios', 'smartphone'],
      sizes: [],
      color: ['Black', 'Blue', 'Green', 'Yellow', 'Pink'],
      quantityBought: 17,
      url: slug('apple-iphone-15-128gb'),
      isActive: true,
      rating: 5,
    },
  });

  await prisma.product.create({
    data: {
      storeId: store1.id,
      name: 'Lenovo IdeaPad 3 Laptop',
      description:
        'Lenovo IdeaPad 3 — Intel Core i5 12th Gen, 8GB RAM, 512GB SSD, 15.6" FHD display, Windows 11 Home. Perfect for students and professionals.',
      price: 5200.00,
      stock: 8,
      images: [
        'https://placehold.co/600x600?text=Lenovo+IdeaPad+3',
        'https://placehold.co/600x600?text=Lenovo+Keyboard',
      ],
      category: 'Phones & Electronics',
      tags: ['laptop', 'lenovo', 'windows', 'computer'],
      sizes: [],
      color: ['Arctic Grey', 'Abyss Blue'],
      quantityBought: 9,
      url: slug('lenovo-ideapad-3-laptop'),
      isActive: true,
      rating: 4,
    },
  });

  await prisma.product.create({
    data: {
      storeId: store1.id,
      name: 'JBL Tune 520BT Wireless Headphones',
      description:
        'JBL Tune 520BT over-ear headphones with 57 hours playtime, Pure Bass sound, and hands-free calling. Foldable and lightweight design.',
      price: 420.00,
      stock: 35,
      images: [
        'https://placehold.co/600x600?text=JBL+Tune+520BT',
        'https://placehold.co/600x600?text=JBL+Folded',
      ],
      category: 'Phones & Electronics',
      tags: ['headphones', 'jbl', 'bluetooth', 'audio'],
      sizes: [],
      color: ['Black', 'White', 'Blue', 'Purple'],
      quantityBought: 63,
      url: slug('jbl-tune-520bt-headphones'),
      isActive: true,
      rating: 4,
    },
  });

  await prisma.product.create({
    data: {
      storeId: store1.id,
      name: 'Anker 65W USB-C GaN Charger',
      description:
        'Anker Nano Pro 65W 3-port GaN charger. Charges laptop, phone, and tablet simultaneously. Includes 1.5m braided USB-C cable.',
      price: 185.00,
      stock: 0,
      images: [
        'https://placehold.co/600x600?text=Anker+GaN+Charger',
      ],
      category: 'Phones & Electronics',
      tags: ['charger', 'anker', 'usb-c', 'accessories'],
      sizes: [],
      color: ['Black', 'White'],
      quantityBought: 28,
      url: slug('anker-65w-gan-charger'),
      isActive: true,
      rating: 5,
    },
  });

  // ── Ama's Fashion House Products ──────────────────────────────────────────

  await prisma.product.create({
    data: {
      storeId: store2.id,
      name: 'Kente Print Ankara Dress',
      description:
        'Hand-sewn Ankara dress featuring vibrant Kente-inspired print. Available in multiple sizes, perfect for events, church, and casual outings.',
      price: 280.00,
      stock: 15,
      images: [
        'https://placehold.co/600x600?text=Ankara+Dress+Front',
        'https://placehold.co/600x600?text=Ankara+Dress+Back',
      ],
      category: 'Fashion',
      tags: ['ankara', 'dress', 'african', 'kente', 'women'],
      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      color: ['Red/Gold', 'Blue/Gold', 'Green/Gold'],
      quantityBought: 34,
      url: slug('kente-print-ankara-dress'),
      isActive: true,
      rating: 5,
    },
  });

  await prisma.product.create({
    data: {
      storeId: store2.id,
      name: "Men's Dashiki Shirt",
      description:
        'Premium cotton Dashiki shirt with intricate embroidery at the neckline. Breathable fabric ideal for the Ghanaian climate. Machine washable.',
      price: 120.00,
      stock: 30,
      images: [
        'https://placehold.co/600x600?text=Dashiki+Shirt+Front',
        'https://placehold.co/600x600?text=Dashiki+Shirt+Side',
      ],
      category: 'Fashion',
      tags: ['dashiki', 'men', 'african', 'shirt'],
      sizes: ['S', 'M', 'L', 'XL', 'XXL'],
      color: ['Orange', 'Purple', 'Teal', 'White'],
      quantityBought: 52,
      url: slug('mens-dashiki-shirt'),
      isActive: true,
      rating: 4,
    },
  });

  await prisma.product.create({
    data: {
      storeId: store2.id,
      name: 'Ladies Leather Tote Bag',
      description:
        'Genuine leather tote bag with interior zip pocket, card slots, and magnetic closure. Fits A4 documents and a 13" laptop.',
      price: 350.00,
      stock: 7,
      images: [
        'https://placehold.co/600x600?text=Leather+Tote+Bag',
        'https://placehold.co/600x600?text=Tote+Bag+Interior',
      ],
      category: 'Shoes & Bags',
      tags: ['bag', 'leather', 'tote', 'women', 'handbag'],
      sizes: [],
      color: ['Brown', 'Black', 'Tan'],
      quantityBought: 19,
      url: slug('ladies-leather-tote-bag'),
      isActive: true,
      rating: 4,
    },
  });

  await prisma.product.create({
    data: {
      storeId: store2.id,
      name: "Women's Block Heel Sandals",
      description:
        'Elegant block heel sandals with ankle strap. 7cm heel height. Padded footbed for all-day comfort. Ideal for office and events.',
      price: 195.00,
      stock: 20,
      images: [
        'https://placehold.co/600x600?text=Block+Heel+Sandals',
        'https://placehold.co/600x600?text=Sandals+Side+View',
      ],
      category: 'Shoes & Bags',
      tags: ['sandals', 'heels', 'women', 'shoes'],
      sizes: ['36', '37', '38', '39', '40', '41', '42'],
      color: ['Nude', 'Black', 'Gold'],
      quantityBought: 25,
      url: slug('womens-block-heel-sandals'),
      isActive: true,
      rating: 4,
    },
  });

  await prisma.product.create({
    data: {
      storeId: store2.id,
      name: 'Waist Beads Set (3 Strands)',
      description:
        'Handmade traditional Ghanaian waist beads made with glass beads. Set of 3 strands — adjustable tie-on style. Great as a gift.',
      price: 65.00,
      stock: 50,
      images: [
        'https://placehold.co/600x600?text=Waist+Beads+Set',
      ],
      category: 'Jewelry & Watches',
      tags: ['waist beads', 'jewelry', 'handmade', 'ghana', 'women'],
      sizes: [],
      color: ['Mixed', 'Red/Gold', 'Blue/White', 'Green/Gold'],
      quantityBought: 88,
      url: slug('waist-beads-set-3-strands'),
      isActive: true,
      rating: 5,
    },
  });

  console.log('✅ Seeding complete!');
  console.log(`   Seller 1: ${seller1.email}  |  Store: ${store1.name} (${store1.url})`);
  console.log(`   Seller 2: ${seller2.email}  |  Store: ${store2.name} (${store2.url})`);
  console.log('   Password for both accounts: Password123!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });