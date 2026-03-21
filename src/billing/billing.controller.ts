import { Body, Controller, Param, Post, BadRequestException, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';
import { CreateBillingCustomerDto } from './dto/create-billing-customer.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { TenantPlan } from '../database/entities/tenant.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('tenants/:tenantId/customer')
  async createCustomer(
    @Param('tenantId') tenantId: string,
    @Body() body: CreateBillingCustomerDto,
  ) {
    const result = await this.billingService.createCustomerForTenant(tenantId, body.email, body.name);
    return { success: true, data: result };
  }

  @Post('tenants/:tenantId/subscriptions/:plan')
  async createSubscription(
    @Param('tenantId') tenantId: string,
    @Param('plan') plan: string,
    @Body() body: CreateSubscriptionDto,
  ) {
    const targetPlan = plan.toLowerCase() as TenantPlan;
    if (!Object.values(TenantPlan).includes(targetPlan)) {
      throw new BadRequestException('Invalid plan');
    }

    const result = await this.billingService.createSubscriptionForTenant(tenantId, body.priceId, targetPlan);
    return { success: true, data: result };
  }
}
