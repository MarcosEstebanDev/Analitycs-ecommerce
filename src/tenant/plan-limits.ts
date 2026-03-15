import { TenantPlan } from '../database/entities/tenant.entity';

export const PLAN_ORDER_LIMITS: Record<TenantPlan, number | null> = {
  [TenantPlan.FREE]: 200,
  [TenantPlan.GROWTH]: 2000,
  [TenantPlan.SCALE]: 10000,
  [TenantPlan.PRO]: null, // unlimited
};

export function getMonthlyOrderLimit(plan: TenantPlan): number | null {
  return PLAN_ORDER_LIMITS[plan];
}
