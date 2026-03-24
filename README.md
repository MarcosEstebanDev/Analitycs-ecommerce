<div align="center">

# 📊 Analitycs E-commerce

### La plataforma de analítica inteligente que convierte los datos de tu tienda en decisiones que generan revenue

[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs)](https://nestjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker)](https://www.docker.com)

</div>

---

## ¿Qué es Analitycs E-commerce?

**Analitycs E-commerce** es una plataforma SaaS multi-tenant que conecta con tu tienda online (Shopify o WooCommerce) y te muestra —en tiempo real— todo lo que necesitás saber para vender más, retener clientes y anticiparte a los problemas antes de que impacten en tu facturación.

> _"La mayoría de las tiendas online toman decisiones basadas en intuición. Las que crecen, las toman basadas en datos."_

Dejá de perder tiempo exportando reportes manuales de Excel. Conectá tu tienda en minutos y empezá a entender qué está pasando realmente con tu negocio.

---

## 🎯 ¿Para quién es esta plataforma?

| Perfil | Problema que resuelve |
|--------|----------------------|
| 🛍️ **Dueños de tiendas Shopify / WooCommerce** | No saben qué productos mueven revenue real ni qué clientes van a dejar de comprar |
| 📈 **Gerentes de e-commerce** | Reportes manuales lentos, sin alertas automáticas ante caídas de ventas |
| 🏢 **Agencias digitales** | Gestionan múltiples tiendas sin una vista centralizada del rendimiento de cada cliente |
| 🚀 **Startups DTC** | Necesitan analítica de nivel enterprise sin el costo ni la complejidad |

---

## 💡 ¿Qué mejora en tu negocio al usar esta herramienta?

### Antes vs. Después

| Antes | Con Analitycs |
|-------|---------------|
| Exportás ventas a Excel cada semana | Dashboard en tiempo real, siempre actualizado |
| Te enterás de una caída de ventas días después | **Alertas automáticas** cuando los ingresos caen más de X% |
| No sabés qué clientes están a punto de irse | **Análisis de cohortes** que muestra tu tasa de retención mes a mes |
| Estimás ventas futuras "a ojo" | **Pronóstico de revenue** con modelos estadísticos para los próximos 30/90 días |
| Ves sólo totales: pedidos y facturación | **LTV por cliente**, ticket promedio, frecuencia de compra y más |
| Tardás horas en armar un informe para un cliente | Un solo dashboard que muestra todo en segundos |

---

## ✨ Funcionalidades Principales

### 📡 Conectores de tiendas
- **Shopify**: conexión directa vía API + webhooks para recibir pedidos en tiempo real
- **WooCommerce**: integración con REST API de WooCommerce (consumer key/secret)
- Múltiples tiendas por cuenta, con filtros por tienda en el dashboard

### 📊 Dashboard de métricas en tiempo real
- **Ingresos totales**, pedidos, ticket promedio y LTV promedio
- Selector de período: últimos 7, 30, 90 días — 6 meses — 1 año
- Gráfico de crecimiento con granularidad adaptativa (diaria, semanal, mensual)
- Top clientes por lifetime value

### 🔮 Pronóstico de revenue (Forecasting)
- Predicción de ingresos para los próximos 30/60/90 días basada en tendencias históricas
- Bandas de confianza (intervalo superior e inferior)
- Indicador de tendencia: al alza, a la baja o estable

### 👥 Análisis de retención (Cohortes)
- Matriz de cohortes mes a mes: cuántos clientes siguen comprando después del primer pedido
- Identificá en qué mes se produce el mayor abandono
- Tomá decisiones de re-engagement basadas en datos reales

### 🚨 Detección de anomalías
- Motor automático que analiza caídas y picos anómalos en revenue, pedidos y AOV
- Umbrales configurables por el usuario (p. ej. alertar si revenue cae más del 20%)
- Clasificación por severidad: info / warning / critical

### 💡 Insights automáticos
- El sistema genera observaciones accionables: "Los clientes nuevos crecieron un 18% respecto al mes anterior"
- Marcá un insight como leído o accionado para mantener el flujo de trabajo limpio
- Filtrado por severidad y tipo

### 📦 Órdenes y clientes
- Lista completa de órdenes con filtros, paginación y exportación a CSV
- Ficha de cliente individual: métricas (LTV, AOV), historial de compras recientes
- Top clientes por revenue con ranking en tiempo real

### 🔔 Notificaciones en tiempo real
- WebSockets (Socket.io): notificaciones push cuando se detecta una anomalía
- Configuración de webhooks externos (Slack, etc.) desde Ajustes

### 💳 Billing con Stripe
- Planes de suscripción listos para conectar a Stripe Checkout
- Soporte multi-plan: Starter / Growth / Enterprise

### 🌙 Dark mode
- Tema oscuro/claro con toggle, persistido por usuario

---

## 🏗️ Arquitectura Técnica

```
┌──────────────────────────────────────────────────────────┐
│                    Angular 17 Frontend                    │
│          (Dashboard SPA · Dark mode · WebSockets)        │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTPS + Bearer JWT
┌────────────────────────▼─────────────────────────────────┐
│               NestJS 11 API (this repo)                   │
│                                                           │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌───────────┐  │
│  │   Auth   │ │Analytics │ │Connectors │ │  Billing  │  │
│  │  (JWT)   │ │ Engine   │ │Shopify/Woo│ │  (Stripe) │  │
│  └──────────┘ └──────────┘ └───────────┘ └───────────┘  │
│                                                           │
│  ┌──────────────┐  ┌────────────────┐                    │
│  │  BullMQ Jobs │  │  WebSockets    │                    │
│  │  (anomalías) │  │  (notifs RT)   │                    │
│  └──────────────┘  └────────────────┘                    │
└───────────┬──────────────────┬───────────────────────────┘
            │                  │
    ┌───────▼───────┐  ┌───────▼───────┐
    │  PostgreSQL   │  │     Redis      │
    │  (multi-tenant│  │  (jobs/cache)  │
    │   con tenant_id│  │               │
    └───────────────┘  └───────────────┘
```

### Stack
| Capa | Tecnología |
|------|-----------|
| Framework | NestJS 11 + TypeScript 5.5 |
| Base de datos | PostgreSQL 15 (TypeORM, multi-tenant) |
| Cache / Jobs | Redis 7 + BullMQ |
| Auth | JWT (access + refresh tokens), bcrypt |
| API Docs | Swagger UI en `/api` (dev mode) |
| Pagos | Stripe SDK |
| Tiempo real | Socket.io (WebSockets) |
| Contenedores | Docker + Docker Compose |

---

## 🚀 Instalación y puesta en marcha

### Requisitos previos
- Node.js 20+
- Docker y Docker Compose

### 1. Clonar e instalar
```bash
git clone https://github.com/MarcosEstebanDev/Analitycs-ecommerce.git
cd Analitycs-ecommerce
npm install
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env
# Editá .env con tus credenciales
```

Variables clave:
| Variable | Descripción |
|----------|-------------|
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Conexión PostgreSQL |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Secretos para tokens JWT |
| `CORS_ORIGIN` | URL del frontend (default: `http://localhost:4200`) |
| `STRIPE_SECRET_KEY` | Clave secreta de Stripe (opcional, modo dry-run si no se configura) |
| `REDIS_URL` | URL de Redis (default: `redis://localhost:6379`) |

### 3. Levantar servicios de base de datos
```bash
docker compose up postgres redis -d
```

### 4. Iniciar el servidor
```bash
# Desarrollo (hot-reload)
npm run start:dev

# Producción
npm run build && npm start
```

### 5. Cargar datos de prueba
```bash
npm run seed
# Crea: admin@demo.com / demo1234 · 20 clientes · 172 órdenes · 4 insights
```

### 6. Ver la documentación de la API
Abrí `http://localhost:3000/api` → Swagger UI con todos los endpoints documentados.

---

## 📡 Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Login, devuelve JWT |
| `POST` | `/api/auth/signup` | Registro de nuevo tenant |
| `GET` | `/api/dashboard/summary` | Métricas principales del dashboard |
| `GET` | `/api/dashboard/growth` | Gráfico de crecimiento (día/semana/mes) |
| `GET` | `/api/dashboard/forecast` | Pronóstico de revenue |
| `GET` | `/api/dashboard/cohort-retention` | Matriz de retención de cohortes |
| `GET` | `/api/dashboard/anomalies` | Anomalías detectadas |
| `GET` | `/api/orders` | Lista de órdenes con filtros |
| `GET` | `/api/customers` | Lista de clientes |
| `GET` | `/api/customers/:id` | Detalle de cliente (LTV, AOV, historial) |
| `POST` | `/api/connectors/shopify/connect-store` | Conectar tienda Shopify |
| `POST` | `/api/connectors/woo/connect-store` | Conectar tienda WooCommerce |

---

## 🧪 Tests

```bash
npm run test          # Unit tests (Jest)
npm run test:e2e      # E2E tests
```

---

## 📁 Estructura del proyecto

```
src/
├── analytics/
│   ├── controllers/     # dashboard, orders, customers
│   └── services/        # analytics, anomaly-detection, alert, forecast
├── auth/                # JWT strategy, guards, interceptors
├── billing/             # Stripe integration
├── connectors/          # Shopify + WooCommerce webhooks/connect
├── database/
│   ├── entities/        # Order, Customer, Tenant, Store, Insight, User
│   └── services/        # OrderService, CustomerService, etc.
├── jobs/                # BullMQ processors
├── notifications/       # WebSocket gateway
└── main.ts              # Bootstrap + Swagger + CORS
```

---

## 🤝 Contribuir

1. Fork del repositorio
2. Creá tu rama: `git checkout -b feature/nueva-funcionalidad`
3. Commit: `git commit -m 'feat: descripción'`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Abrí un Pull Request

---

## 📄 Licencia

MIT © [MarcosEstebanDev](https://github.com/MarcosEstebanDev)

---

<div align="center">

**¿Querés una demo? ¿Tenés preguntas?**
Abrí un [issue](https://github.com/MarcosEstebanDev/Analitycs-ecommerce/issues) o escribinos.

⭐ Si este proyecto te resultó útil, dejanos una estrella en GitHub.

</div>

