import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { TenantService } from '../database/services';
import { TenantPlan } from '../database/entities/tenant.entity';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    private readonly tenantService: TenantService,
  ) {
    const apiKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!apiKey) {
      this.logger.warn('STRIPE_SECRET_KEY not configured. BillingService will run in dry-run mode.');
    }
    this.stripe = new Stripe(apiKey || 'sk_test_placeholder', {
      // Use the default API version from the Stripe package
      apiVersion: undefined,
    });
  }

  async createCustomerForTenant(tenantId: string, email: string, name?: string) {
    const tenant = await this.tenantService.findById(tenantId);
    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }

    if (!email) {
      throw new BadRequestException('Billing email is required');
    }

    if (!this.configService.get('STRIPE_SECRET_KEY')) {
      // Dry-run: just persist billingEmail
      const updated = await this.tenantService.update(tenantId, {
        billingEmail: email,
      });
      return { tenant: updated, stripeCustomer: null };
    }

    const customer = await this.stripe.customers.create({
      email,
      name: name || tenant.name,
      metadata: { tenantId },
    });

    const updatedTenant = await this.tenantService.update(tenantId, {
      billingEmail: email,
      stripeCustomerId: customer.id,
    });

    return { tenant: updatedTenant, stripeCustomer: customer };
  }

  async createCheckoutSession(tenantId: string, planId: string): Promise<{ url: string; dryRun?: boolean }> {
    const tenant = await this.tenantService.findById(tenantId);
    if (!tenant) throw new BadRequestException('Tenant not found');

    if (!['growth', 'scale'].includes(planId)) {
      throw new BadRequestException('Invalid plan for checkout');
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:4200';

    if (!this.configService.get('STRIPE_SECRET_KEY')) {
      // Dry-run: redirect back to billing with demo flag
      return { url: `${frontendUrl}/billing?demo=true&plan=${planId}`, dryRun: true };
    }

    const priceId = this.configService.get<string>(`STRIPE_PRICE_${planId.toUpperCase()}`);
    if (!priceId) {
      throw new BadRequestException(`STRIPE_PRICE_${planId.toUpperCase()} not configured`);
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${frontendUrl}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/billing`,
      metadata: { tenantId, targetPlan: planId },
    };

    if (tenant.stripeCustomerId) {
      sessionParams.customer = tenant.stripeCustomerId;
    } else if (tenant.billingEmail) {
      sessionParams.customer_email = tenant.billingEmail;
    }

    const session = await this.stripe.checkout.sessions.create(sessionParams);
    return { url: session.url! };
  }

  async createSubscriptionForTenant(tenantId: string, priceId: string, targetPlan: TenantPlan) {
    const tenant = await this.tenantService.findById(tenantId);
    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }

    if (!priceId) {
      throw new BadRequestException('priceId is required');
    }

    if (!this.configService.get('STRIPE_SECRET_KEY')) {
      // Dry-run: just update plan locally
      const updated = await this.tenantService.update(tenantId, {
        plan: targetPlan,
        subscriptionStatus: 'active',
      });
      return { tenant: updated, stripeSubscription: null };
    }

    if (!tenant.stripeCustomerId) {
      throw new BadRequestException('Tenant has no Stripe customer. Create customer first.');
    }

    const subscription = await this.stripe.subscriptions.create({
      customer: tenant.stripeCustomerId,
      items: [{ price: priceId }],
      metadata: { tenantId },
      expand: ['latest_invoice.payment_intent'],
    });

    const updatedTenant = await this.tenantService.update(tenantId, {
      plan: targetPlan,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
    });

    return { tenant: updatedTenant, stripeSubscription: subscription };
  }
}
