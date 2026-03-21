import { Controller, Get, Query, Req, Res, BadRequestException, Logger, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../../database/entities';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  private readonly logger = new Logger(CustomersController.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
  ) {}

  private buildQuery(tenantId: string, search?: string, sortBy: string = 'ltv') {
    const query = this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.tenantId = :tenantId', { tenantId });

    if (search) {
      query.andWhere(
        '(customer.email ILIKE :q OR customer.firstName ILIKE :q OR customer.lastName ILIKE :q)',
        { q: `%${search}%` },
      );
    }

    switch (sortBy) {
      case 'orders':
        query.orderBy('customer.totalOrders', 'DESC');
        break;
      case 'date':
        query.orderBy('customer.createdAt', 'DESC');
        break;
      case 'ltv':
      default:
        query.orderBy('customer.lifetimeValue', 'DESC');
        break;
    }

    return query;
  }

  @Get()
  async getCustomers(
    @Req() req: Request,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
    @Query('sortBy') sortBy: string = 'ltv',
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenant context');

    try {
      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
      const skip = (pageNum - 1) * limitNum;

      const query = this.buildQuery(tenantId, search, sortBy);
      const [customers, total] = await query
        .skip(skip)
        .take(limitNum)
        .getManyAndCount();

      return {
        success: true,
        data: {
          customers,
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum),
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error fetching customers: ${message}`);
      return { success: false, error: message };
    }
  }

  @Get('export')
  async exportCustomers(
    @Req() req: Request,
    @Res() res: Response,
    @Query('search') search?: string,
    @Query('sortBy') sortBy: string = 'ltv',
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenant context');

    try {
      const query = this.buildQuery(tenantId, search, sortBy);
      const customers = await query.getMany();

      const header = 'id,email,firstName,lastName,lifetimeValue,totalOrders,lastOrderAt,createdAt\n';
      const rows = customers.map((c) =>
        [
          c.id,
          c.email ?? '',
          c.firstName ?? '',
          c.lastName ?? '',
          c.lifetimeValue,
          c.totalOrders,
          c.lastOrderAt ? c.lastOrderAt.toISOString() : '',
          c.createdAt.toISOString(),
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      );

      const csv = header + rows.join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
      res.send(csv);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error exporting customers: ${message}`);
      res.status(500).json({ success: false, error: message });
    }
  }
}
