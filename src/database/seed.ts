import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Tenant, Store, Order, OrderItem, Customer, Insight, User, UserRole } from './entities';
import { TenantPlan } from './entities/tenant.entity';
import { StoreProvider } from './entities/store.entity';
import { OrderStatus } from './entities/order.entity';
import { InsightType, InsightSeverity } from './entities/insight.entity';

const DEMO_EMAIL = 'admin@demo.com';
const DEMO_PASSWORD = 'demo1234';

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number) {
  return Math.floor(randomBetween(min, max + 1));
}

function daysAgo(days: number, jitterHours = 12): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(randomInt(8, 22), randomInt(0, 59), 0, 0);
  return d;
}

const PRODUCTS = [
  { name: 'Zapatillas Running Pro', price: 89.99 },
  { name: 'Remera Deportiva Dry-Fit', price: 29.99 },
  { name: 'Mochila Urbana 25L', price: 54.99 },
  { name: 'Auriculares Bluetooth', price: 119.99 },
  { name: 'Reloj Inteligente FitPro', price: 199.99 },
  { name: 'Botella Térmica 1L', price: 22.99 },
  { name: 'Suplemento Proteico 1kg', price: 44.99 },
  { name: 'Short Deportivo', price: 24.99 },
  { name: 'Calcetines Pack x5', price: 14.99 },
  { name: 'Camiseta Polo Classic', price: 39.99 },
];

const FIRST_NAMES = ['Lucía', 'Mateo', 'Valentina', 'Santiago', 'Camila', 'Benjamín', 'Isabella', 'Martín', 'Sofía', 'Tomás',
  'Florencia', 'Agustín', 'Julieta', 'Nicolás', 'Antonella', 'Diego', 'Daniela', 'Facundo', 'Romina', 'Leandro'];
const LAST_NAMES = ['González', 'Rodríguez', 'Martínez', 'López', 'García', 'Fernández', 'Pérez', 'Sánchez', 'Romero', 'Torres',
  'Díaz', 'Álvarez', 'Ruiz', 'Moreno', 'Jiménez', 'Herrera', 'Castro', 'Vargas', 'Ramos', 'Mendoza'];

const databaseUrl = process.env.DATABASE_URL;

const AppDataSource = databaseUrl
  ? new DataSource({
      type: 'postgres',
      url: databaseUrl,
      ssl: { rejectUnauthorized: false },
      entities: [Tenant, Store, Order, OrderItem, Customer, Insight, User],
      synchronize: false,
    })
  : new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'analytics',
      password: process.env.DB_PASSWORD || 'analytics',
      database: process.env.DB_NAME || 'analytics',
      entities: [Tenant, Store, Order, OrderItem, Customer, Insight, User],
      synchronize: false,
    });

async function seed() {
  await AppDataSource.initialize();
  console.log('✅ Conectado a la base de datos\n');

  const tenantRepo = AppDataSource.getRepository(Tenant);
  const userRepo = AppDataSource.getRepository(User);

  // Tenant
  let tenant = await tenantRepo.findOne({ where: { slug: 'demo' } });

  if (tenant) {
    console.log('ℹ️  El tenant demo ya existe\n');
  } else {
    tenant = tenantRepo.create({
      name: 'Demo Store',
      slug: 'demo',
      plan: TenantPlan.GROWTH,
      billingEmail: DEMO_EMAIL,
    });
    tenant = await tenantRepo.save(tenant);
    console.log('🎉 Tenant demo creado\n');
  }

  // User admin demo
  let user = await userRepo.findOne({ where: { email: DEMO_EMAIL } });

  if (user) {
    console.log('ℹ️  El usuario demo ya existe\n');
  } else {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    user = userRepo.create({
      tenantId: tenant.id,
      email: DEMO_EMAIL,
      passwordHash,
      role: UserRole.ADMIN,
      firstName: 'Admin',
      lastName: 'Demo',
      isActive: true,
    });
    user = await userRepo.save(user);
    console.log('🎉 Usuario admin demo creado\n');
  }

  // ── Store ─────────────────────────────────────────────────────────────
  const storeRepo = AppDataSource.getRepository(Store);
  let store = await storeRepo.findOne({ where: { tenantId: tenant.id } });

  if (store) {
    console.log('ℹ️  La tienda demo ya existe\n');
  } else {
    store = storeRepo.create({
      tenantId: tenant.id,
      provider: StoreProvider.SHOPIFY,
      name: 'Demo Shopify Store',
      externalId: 'demo-store.myshopify.com',
      accessToken: 'demo-access-token',
      totalOrdersSync: 0,
      isActive: true,
    });
    store = await storeRepo.save(store);
    console.log('🏪 Tienda demo creada\n');
  }

  // ── Customers ─────────────────────────────────────────────────────────
  const customerRepo = AppDataSource.getRepository(Customer);
  const existingCustomers = await customerRepo.count({ where: { tenantId: tenant.id } });

  let customers: Customer[] = [];
  if (existingCustomers > 0) {
    customers = await customerRepo.find({ where: { tenantId: tenant.id } });
    console.log(`ℹ️  Ya existen ${existingCustomers} clientes\n`);
  } else {
    const customerData = FIRST_NAMES.map((firstName, i) => {
      const lastName = LAST_NAMES[i % LAST_NAMES.length];
      const totalOrders = randomInt(1, 18);
      const lifetimeValue = parseFloat((totalOrders * randomBetween(45, 220)).toFixed(2));
      return customerRepo.create({
        tenantId: tenant.id,
        storeId: store!.id,
        externalId: `cust-demo-${i + 1}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@demo.com`,
        firstName,
        lastName,
        totalOrders,
        lifetimeValue,
        totalQuantity: totalOrders * randomInt(1, 3),
        lastOrderAt: daysAgo(randomInt(1, 60)),
      });
    });
    customers = await customerRepo.save(customerData);
    console.log(`👥 ${customers.length} clientes creados\n`);
  }

  // ── Orders + OrderItems ───────────────────────────────────────────────
  const orderRepo = AppDataSource.getRepository(Order);
  const itemRepo = AppDataSource.getRepository(OrderItem);
  const existingOrders = await orderRepo.count({ where: { tenantId: tenant.id } });

  if (existingOrders > 0) {
    console.log(`ℹ️  Ya existen ${existingOrders} pedidos\n`);
  } else {
    // Distribute orders over last 6 months with a growing trend
    const monthlyVolumes = [18, 22, 25, 30, 35, 42]; // crecimiento mes a mes
    let orderCount = 0;

    for (let monthOffset = 5; monthOffset >= 0; monthOffset--) {
      const volume = monthlyVolumes[5 - monthOffset];
      const daysStart = (monthOffset + 1) * 30;
      const daysEnd = monthOffset * 30 + 1;

      for (let i = 0; i < volume; i++) {
        const customer = customers[randomInt(0, customers.length - 1)];
        const orderDaysAgo = randomInt(daysEnd, daysStart);
        const orderDate = daysAgo(orderDaysAgo);

        const numItems = randomInt(1, 4);
        const selectedProducts = [...PRODUCTS].sort(() => Math.random() - 0.5).slice(0, numItems);

        const subtotal = selectedProducts.reduce((sum, p) => sum + p.price * randomInt(1, 3), 0);
        const tax = parseFloat((subtotal * 0.21).toFixed(2));
        const shipping = subtotal > 100 ? 0 : 8.99;
        const totalAmount = parseFloat((subtotal + tax + shipping).toFixed(2));

        const order = orderRepo.create({
          tenantId: tenant.id,
          storeId: store!.id,
          customerId: customer.id,
          externalId: `order-demo-${++orderCount}`,
          externalCustomerId: customer.externalId,
          totalAmount,
          subtotal: parseFloat(subtotal.toFixed(2)),
          tax,
          shipping,
          discount: 0,
          status: OrderStatus.DELIVERED,
          currency: 'USD',
          createdAt: orderDate,
        });
        const savedOrder = await orderRepo.save(order);

        const items = selectedProducts.map((product) => {
          const qty = randomInt(1, 3);
          return itemRepo.create({
            orderId: savedOrder.id,
            externalProductId: `prod-${product.name.replace(/\s+/g, '-').toLowerCase()}`,
            productName: product.name,
            price: product.price,
            quantity: qty,
            lineTotal: parseFloat((product.price * qty).toFixed(2)),
          });
        });
        await itemRepo.save(items);
      }
    }
    console.log(`📦 ${orderCount} pedidos creados con items\n`);
  }

  // ── Insights ──────────────────────────────────────────────────────────
  const insightRepo = AppDataSource.getRepository(Insight);
  const existingInsights = await insightRepo.count({ where: { tenantId: tenant.id } });

  if (existingInsights > 0) {
    console.log(`ℹ️  Ya existen ${existingInsights} insights\n`);
  } else {
    const insightData = [
      insightRepo.create({
        tenantId: tenant.id,
        storeId: store!.id,
        type: InsightType.CUSTOMER_GROWTH,
        severity: InsightSeverity.INFO,
        message: 'Crecimiento de clientes sostenido',
        description: 'Los nuevos clientes aumentaron un 18% respecto al mes anterior.',
        isRead: false,
        isActioned: false,
      }),
      insightRepo.create({
        tenantId: tenant.id,
        storeId: store!.id,
        type: InsightType.HIGH_AOV,
        severity: InsightSeverity.INFO,
        message: 'Ticket promedio por encima del objetivo',
        description: 'El AOV de esta semana superó los $120, +12% vs semana anterior.',
        isRead: false,
        isActioned: false,
      }),
      insightRepo.create({
        tenantId: tenant.id,
        storeId: store!.id,
        type: InsightType.REPEAT_CUSTOMER,
        severity: InsightSeverity.INFO,
        message: 'Alta tasa de clientes recurrentes',
        description: 'El 42% de los pedidos del mes provienen de clientes que ya compraron antes.',
        isRead: true,
        isActioned: false,
      }),
      insightRepo.create({
        tenantId: tenant.id,
        storeId: store!.id,
        type: InsightType.SEASONAL_TREND,
        severity: InsightSeverity.WARNING,
        message: 'Posible tendencia estacional detectada',
        description: 'Históricamente, los pedidos caen un 15% en este período. Considerar campaña de retención.',
        isRead: false,
        isActioned: false,
      }),
    ];
    await insightRepo.save(insightData);
    console.log(`💡 ${insightData.length} insights creados\n`);
  }

  // ── Summary ───────────────────────────────────────────────────────────
  console.log('─────────────────────────────────────');
  console.log(`  Tenant ID : ${tenant.id}`);
  console.log(`  Nombre    : ${tenant.name}`);
  console.log(`  Plan      : ${tenant.plan}`);
  console.log('─────────────────────────────────────');
  console.log('\n📋 Credenciales para el login:');
  console.log(`  Email     : ${DEMO_EMAIL}`);
  console.log(`  Contraseña: ${DEMO_PASSWORD}`);
  console.log('─────────────────────────────────────\n');

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('❌ Error en seed:', err.message);
  process.exit(1);
});
