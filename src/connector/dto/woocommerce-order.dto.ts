export class WooOrderPayload {
  id!: number;
  number!: string;
  status!: string; // pending, processing, on-hold, completed, cancelled, refunded, failed
  currency!: string;
  date_created!: string;
  date_modified!: string;
  total!: string;
  subtotal!: string;
  total_tax!: string;
  billing!: {
    first_name: string;
    last_name: string;
    email: string;
  };
  shipping_lines!: Array<{
    total: string;
  }>;
  discount_total!: string;
  line_items!: Array<{
    id: number;
    product_id: number;
    name: string;
    price: number;
    quantity: number;
  }>;
  customer_id!: number;
  customer_note!: string;
}
