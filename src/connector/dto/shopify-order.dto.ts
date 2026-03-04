export class ShopifyOrderPayload {
  id!: number;
  name!: string;
  email!: string;
  customer!: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
  };
  total_price!: string;
  subtotal_price!: string;
  total_tax!: string;
  shipping_lines!: Array<{
    price: string;
  }>;
  discount_applications!: Array<{
    value: string;
  }>;
  currency!: string;
  created_at!: string;
  updated_at!: string;
  status!: string;
  financial_status!: string;
  line_items!: Array<{
    id: number;
    product_id: number;
    title: string;
    price: string;
    quantity: number;
  }>;
}
