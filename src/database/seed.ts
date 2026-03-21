import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Tenant, Store, Order, OrderItem, Customer, Insight } from './entities';
import { TenantPlan } from './entities/tenant.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'analytics',
  password: process.env.DB_PASSWORD || 'analytics',
  database: process.env.DB_NAME || 'analytics',
  entities: [Tenant, Store, Order, OrderItem, Customer, Insight],
  synchronize: true,
});

async function seed() {
  await AppDataSource.initialize();
  console.log('✅ Conectado a la base de datos\n');

  const tenantRepo = AppDataSource.getRepository(Tenant);

  // Check if demo tenant already exists
  let tenant = await tenantRepo.findOne({ where: { slug: 'demo' } });

  if (tenant) {
    console.log('ℹ️  El tenant demo ya existe:\n');
  } else {
    tenant = tenantRepo.create({
      name: 'Demo Store',
      slug: 'demo',
      plan: TenantPlan.GROWTH,
      billingEmail: 'admin@demo.com',
    });
    tenant = await tenantRepo.save(tenant);
    console.log('🎉 Tenant demo creado:\n');
  }

  console.log('─────────────────────────────────────');
  console.log(`  Tenant ID : ${tenant.id}`);
  console.log(`  Nombre    : ${tenant.name}`);
  console.log(`  Plan      : ${tenant.plan}`);
  console.log('─────────────────────────────────────');
  console.log('\n📋 Credenciales para el login:');
  console.log('  Email     : admin@demo.com');
  console.log(`  Tenant ID : ${tenant.id}`);
  console.log('\n  (Copiá el Tenant ID y pegalo en el campo "Tenant ID" del login)\n');

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('❌ Error en seed:', err.message);
  process.exit(1);
});
