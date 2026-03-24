import { Controller, Get, Query, Req, Res, BadRequestException, Logger, UseGuards, Param, NotFoundException } from '@nestjs/common';
import { Request, Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer, Order } from '../../database/entities';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  private readonly logger = new Logger(CustomersController.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
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

  @Get(':id')
  async getCustomerById(
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenant context');

    const customer = await this.customerRepository.findOne({
      where: { id, tenantId },
    });

    if (!customer) throw new NotFoundException(`Customer ${id} not found`);

    const recentOrders = await this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'orderItems')
      .where('order.tenantId = :tenantId', { tenantId })
      .andWhere('order.customerId = :customerId', { customerId: id })
      .orderBy('order.createdAt', 'DESC')
      .take(10)
      .getMany();

    const ltv = Number(customer.lifetimeValue);
    const totalOrders = customer.totalOrders;
    const aov = ltv / Math.max(totalOrders, 1);

    return {
      success: true,
      data: {
        customer,
        recentOrders,
        metrics: { ltv, totalOrders, aov },
      },
    };
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