# SaaS de Analítica Inteligente para E-commerce

## 1. Visión del Producto

Construir una plataforma SaaS multi-tenant que permita a tiendas e-commerce entender, predecir y optimizar su rendimiento mediante analítica avanzada e insights accionables automatizados.

No es solo un dashboard. Es un sistema que:

- Detecta problemas automáticamente.
- Predice ventas.
- Identifica oportunidades de crecimiento.
- Genera alertas accionables.

**Objetivo:** convertirse en una herramienta indispensable para optimizar revenue.

---

## 2. Modelo de Negocio

### 2.1 Segmento Objetivo

- Tiendas Shopify.
- WooCommerce.
- E-commerce DTC.
- Agencias que gestionan múltiples tiendas.

### 2.2 Métricas Clave

- MRR.
- ARPU.
- CAC.
- LTV.
- Churn.
- Activación (conectar tienda + ver primer insight).

---

## 3. Arquitectura Técnica General

Arquitectura orientada a eventos + microservicios ligeros.

### 3.1 Componentes Principales

1. API Gateway.
2. Auth Service.
3. Connector Service.
4. Analytics Engine.
5. AI Insight Service.
6. Notification Service.
7. Billing Service.

---

## 4. Stack Tecnológico

### Backend Principal

- Node.js 20 LTS.
- NestJS 10.x.
- TypeScript 5.x.

### Base de Datos

- PostgreSQL 16.
- ClickHouse (analytics agregada).
- Redis 7.x (cache + jobs).

### Colas y Background Jobs

- BullMQ.
- Redis.

### Infraestructura

- Docker.
- Docker Compose (local).
- AWS (ECS o EKS).
- RDS (PostgreSQL).
- S3 (reportes).
- Cloudflare (CDN + seguridad).

### Observabilidad

- OpenTelemetry.
- Prometheus.
- Grafana.
- Sentry.

---

## 5. Arquitectura Detallada

### 5.1 Flujo de Datos

1. Usuario conecta tienda (OAuth).
2. Webhooks envían eventos (orders, refunds, customers).
3. Connector Service normaliza datos.
4. Eventos enviados a cola.
5. Analytics Engine procesa y guarda agregados.
6. AI Service detecta anomalías.
7. Notification Service envía alertas.

---

## 6. Modelo Multi-Tenant

Estrategia inicial:

- Una sola base.
- Columna `tenant_id` en todas las tablas.
- Índices compuestos por tenant.

Escalado futuro:

- Separación por base de datos.
- Particionado por tenant.

---

## 7. Módulo de Analítica

### Métricas Iniciales

- Revenue.
- Conversion Rate.
- Average Order Value.
- LTV.
- CAC estimado.
- Retención.

### Detección de Anomalías

**Reglas simples:**

- Variación > X%.
- Caída de revenue > baseline.
- Aumento de abandono.

**Fase 2:**

- Modelos de regresión.
- Forecasting con Prophet o similar.

---

## 8. Seguridad

- JWT + Refresh tokens.
- OAuth tiendas.
- Rate limiting.
- Validación fuerte DTOs.
- Logs de auditoría.

---

## 9. Riesgos

- Competencia alta.
- Dependencia de APIs externas.
- Costos elevados si no se optimizan queries.

---

## 10. Objetivo a 24 Meses

- 2.000 clientes pagos.
- MRR > USD 100k.
- Producto vendible o altamente escalable.

---

## 11. Inicio del desarrollo (Mes 1 - Base implementada)

Se inició la primera fase técnica del proyecto con una base funcional en NestJS:

- **Arquitectura base:** aplicación API inicial con módulos organizados por dominio.
- **Auth:** endpoint `POST /api/auth/login` con emisión de `accessToken` y `refreshToken` JWT.
- **Multi-tenant:** middleware inicial que toma `x-tenant-id` por request para contextualizar operaciones.
- **Conector Shopify:** endpoint `POST /api/connectors/shopify/webhook/orders-created` para recepción inicial de eventos de pedidos.
- **Healthcheck:** endpoint `GET /api/health` para verificación de disponibilidad.

### 11.1 Cómo ejecutar localmente

1. Instalar dependencias:

```bash
npm install
```

2. Copiar variables de entorno:

```bash
cp .env.example .env
```

3. Levantar en desarrollo:

```bash
npm run start:dev
```

4. Ejecutar pruebas e2e:

```bash
npm run test:e2e
```

---

Documento base para continuar iterando la implementación del MVP.
