import { Controller, Get, Param, Query, Req, Res, BadRequestException, Logger, UseGuards, NotFoundException } from '@nestjs/common';
import { Request, Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../../database/entities';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  private buildQuery(tenantId: string, status?: string, search?: string, startDate?: string, endDate?: string) {
    const query = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.store', 'store')
      .where('order.tenantId = :tenantId', { tenantId });

    if (status && Object.values(OrderStatus).includes(status as OrderStatus)) {
      query.andWhere('order.status = :status', { status });
    }

    if (search) {
      query.andWhere(
        '(order.externalId ILIKE :search OR customer.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (startDate) {
      query.andWhere('order.createdAt >= :startDate', { startDate: new Date(startDate) });
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.andWhere('order.createdAt <= :endDate', { endDate: end });
    }

    return query;
  }

  @Get()
  async getOrders(
    @Req() req: Request,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenant context');

    try {
      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
      const skip = (pageNum - 1) * limitNum;

      const query = this.buildQuery(tenantId, status, search, startDate, endDate);
      const [orders, total] = await query
        .orderBy('order.createdAt', 'DESC')
        .skip(skip)
        .take(limitNum)
        .getManyAndCount();

      return {
        success: true,
        data: {
          orders,
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum),
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error fetching orders: ${message}`);
      return { success: false, error: message };
    }
  }

  @Get('export')
  async exportOrders(
    @Req() req: Request,
    @Res() res: Response,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenant context');

    try {
      const query = this.buildQuery(tenantId, status, search, startDate, endDate);
      const orders = await query.orderBy('order.createdAt', 'DESC').getMany();

      const header = 'id,externalId,status,totalAmount,currency,customerEmail,createdAt\n';
      const rows = orders.map((o) => {
        const email = (o.customer as any)?.email ?? '';
        return [
          o.id,
          o.externalId,
          o.status,
          o.totalAmount,
          o.currency,
          email,
          o.createdAt.toISOString(),
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',');
      });

      const csv = header + rows.join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
      res.send(csv);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error exporting orders: ${message}`);
      res.status(500).json({ success: false, error: message });
    }
  }

  @Get(':id')
  async getOrderById(@Param('id') id: string, @Req() req: Request) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenant context');

    const order = await this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.store', 'store')
      .leftJoinAndSelect('order.items', 'items')
      .where('order.id = :id', { id })
      .andWhere('order.tenantId = :tenantId', { tenantId })
      .getOne();

    if (!order) throw new NotFoundException('Order not found');

    return { success: true, data: order };
  }
}
