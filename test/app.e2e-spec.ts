import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('App (e2e)', () => {
  let app: INestApplication;
  let jwtToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
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

  // ─── Auth ──────────────────────────────────────────────────────────────────

  it('POST /api/auth/login → 201 con tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('x-tenant-id', 'tenant-test')
      .send({ email: 'admin@test.com' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.tokenType).toBe('Bearer');
    jwtToken = res.body.accessToken as string;
  });

  it('POST /api/auth/login sin email → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({});
    expect(res.status).toBe(400);
  });

  // ─── Dashboard (protegido) ─────────────────────────────────────────────────

  it('GET /api/dashboard/metrics sin JWT → 401', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dashboard/metrics')
      .set('x-tenant-id', 'tenant-test');
    expect(res.status).toBe(401);
  });

  it('GET /api/dashboard/metrics con JWT → 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dashboard/metrics')
      .set('Authorization', `Bearer ${jwtToken}`)
      .set('x-tenant-id', 'tenant-test');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('totalRevenue');
    expect(res.body.data).toHaveProperty('totalOrders');
  });

  it('GET /api/dashboard/summary con JWT → 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${jwtToken}`)
      .set('x-tenant-id', 'tenant-test');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ─── Tenants ───────────────────────────────────────────────────────────────

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

