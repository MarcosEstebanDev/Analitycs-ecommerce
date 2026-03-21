import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Tenant, Store, Order, OrderItem, Customer, Insight, User, UserRole } from './entities';
import { TenantPlan } from './entities/tenant.entity';

const DEMO_EMAIL = 'admin@demo.com';
const DEMO_PASSWORD = 'demo1234';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'analytics',
  password: process.env.DB_PASSWORD || 'analytics',
  database: process.env.DB_NAME || 'analytics',
  entities: [Tenant, Store, Order, OrderItem, Customer, Insight, User],
  synchronize: true,
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
