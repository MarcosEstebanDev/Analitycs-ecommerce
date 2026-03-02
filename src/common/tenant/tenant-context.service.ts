import { Injectable } from '@nestjs/common';

@Injectable()
export class TenantContextService {
  private tenantId: string | null = null;

  setTenantId(tenantId: string | null) {
    this.tenantId = tenantId;
  }

  getTenantId() {
    return this.tenantId;
  }
}
