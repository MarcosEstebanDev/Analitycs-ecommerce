import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

// Credentials created during the test run via signup
const TEST_EMAIL = `e2e-${Date.now()}@test.com`;
const TEST_PASSWORD = 'SecurePass123!';
const TEST_TENANT = `E2E Corp ${Date.now()}`;

describe('App (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshToken: string;
  let tenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Health ────────────────────────────────────────────────────────────────

  it('GET /health → 200 ok', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  // ─── Auth: rutas protegidas sin JWT ────────────────────────────────────────

  it('GET /api/dashboard/metrics sin JWT → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/dashboard/metrics');
    expect(res.status).toBe(401);
  });

  it('GET /api/orders sin JWT → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/orders');
    expect(res.status).toBe(401);
  });

  // ─── Auth: Signup (crea tenant + usuario únicos para este test run) ────────

  it('POST /api/auth/signup → 201 con tokens y tenantId', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({
        tenantName: TEST_TENANT,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        firstName: 'E2E',
        lastName: 'Test',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.tokenType).toBe('Bearer');
    expect(res.body).toHaveProperty('tenantId');

    accessToken = res.body.accessToken as string;
    refreshToken = res.body.refreshToken as string;
    tenantId = res.body.tenantId as string;
  });

  it('POST /api/auth/signup con email duplicado → 409', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({
        tenantName: `Otro Corp ${Date.now()}`,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });
    expect(res.status).toBe(409);
  });

  it('POST /api/auth/signup sin password → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({ tenantName: 'Corp', email: 'x@x.com' });
    expect(res.status).toBe(400);
  });

  // ─── Auth: Login ───────────────────────────────────────────────────────────

  it('POST /api/auth/login → 201 con tokens válidos', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.tokenType).toBe('Bearer');
    // Refresh accessToken for subsequent tests
    accessToken = res.body.accessToken as string;
    refreshToken = res.body.refreshToken as string;
  });

  it('POST /api/auth/login con password incorrecta → 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: 'WrongPassword99!' });
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login sin email → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ password: TEST_PASSWORD });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/login con email inexistente → 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'noexiste@nada.com', password: TEST_PASSWORD });
    expect(res.status).toBe(401);
  });

  // ─── Auth: Refresh token ───────────────────────────────────────────────────

  it('POST /api/auth/refresh → 201 nuevo accessToken', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.tokenType).toBe('Bearer');
  });

  it('POST /api/auth/refresh con token inválido → 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: 'token-invalido' });
    expect(res.status).toBe(401);
  });

  // ─── Dashboard (protegido) ─────────────────────────────────────────────────

  it('GET /api/dashboard/metrics con JWT → 200 con campos esperados', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dashboard/metrics')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('totalRevenue');
    expect(res.body.data).toHaveProperty('totalOrders');
    expect(res.body.data).toHaveProperty('averageOrderValue');
  });

  it('GET /api/dashboard/summary con JWT → 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('metrics');
  });

  it('GET /api/dashboard/growth?days=7&granularity=day → 200 array', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dashboard/growth?days=7&granularity=day')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    // 7 buckets diarios para un nuevo tenant (pueden ser ceros)
    expect(res.body.data.length).toBe(7);
    if (res.body.data.length > 0) {
      expect(res.body.data[0]).toHaveProperty('month');
      expect(res.body.data[0]).toHaveProperty('revenue');
    }
  });

  it('GET /api/dashboard/growth?days=30&granularity=day → 200 array de 30', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dashboard/growth?days=30&granularity=day')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(30);
  });

  // ─── Orders (protegido) ────────────────────────────────────────────────────

  it('GET /api/orders con JWT → 200 respuesta paginada', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('orders');
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).toHaveProperty('page');
    expect(res.body.data).toHaveProperty('pages');
    expect(Array.isArray(res.body.data.orders)).toBe(true);
  });

  it('GET /api/orders?page=1&limit=5 → respeta parámetros de paginación', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/orders?page=1&limit=5')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);

    expect(res.status).toBe(200);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.limit).toBe(5);
  });

  // ─── Billing ──────────────────────────────────────────────────────────────

  it('POST /api/billing/checkout-session con JWT → 200 dry-run URL', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/billing/checkout-session')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({ planId: 'growth' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('url');
    expect(res.body.data.dryRun).toBe(true);
  });

  it('POST /api/billing/checkout-session con plan inválido → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/billing/checkout-session')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({ planId: 'free' }); // free no es válido para checkout

    expect(res.status).toBe(400);
  });

  it('POST /api/billing/checkout-session sin JWT → 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/billing/checkout-session')
      .send({ planId: 'growth' });
    expect(res.status).toBe(401);
  });

  // ─── Tenants (público) ─────────────────────────────────────────────────────

  it('GET /api/tenants → 200 (lista pública)', async () => {
    const res = await request(app.getHttpServer()).get('/api/tenants');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/tenants → 201 crea tenant', async () => {
    const slug = `test-tenant-${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post('/api/tenants')
      .send({ name: 'Test Tenant', slug, plan: 'free' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.slug).toBe(slug);
  });

  it('POST /api/tenants con slug duplicado → 400', async () => {
    const slug = `dup-tenant-${Date.now()}`;
    await request(app.getHttpServer())
      .post('/api/tenants')
      .send({ name: 'First', slug, plan: 'free' });

    const res = await request(app.getHttpServer())
      .post('/api/tenants')
      .send({ name: 'Second', slug, plan: 'free' });

    expect(res.status).toBe(400);
  });
});

