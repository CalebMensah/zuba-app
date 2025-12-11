export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  price: number;
  unitPrice?: number;
  total: number;
  commission: number;
  createdAt: string;
  name?: string;
  productName?: string;
  product?: {
    id: string;
    name: string;
    images: string[];
    // Add other product fields as needed
  };
  paymentMethod?: string;
}

export interface DeliveryInfoInput {
  recipient: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  region: string;
  country: string;
  postalCode?: string;
  deliveryType?: string;
  deliveryFee?: number;
  deliveryInstructions?: string;
  preferredDeliveryDate?: string;
  preferredDeliveryTime?: string;
  notes?: string;
}

export interface CreateOrderData {
  items: {
    productId: string;
    quantity: number;
    price: number;
  }[];
  deliveryInfo: DeliveryInfoInput;
  deliveryFee?: number;
  taxAmount?: number;
  discount?: number;
  currency?: string;
  paymentProvider?: string;
  promoCode?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  checkoutSession?: string;
  sameAsDelivery?: boolean;
  billingInfo?: any;
}

export interface DeliveryInfo {
  id: string;
  orderId: string;
  recipient: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  region: string;
  country: string;
  postalCode?: string;
  deliveryType?: string;
  deliveryFee?: number;
  deliveryInstructions?: string;
  preferredDeliveryDate?: string;
  preferredDeliveryTime?: string;
  notes?: string;
  courierService?: string;
  driverName?: string;
  driverPhone?: string;
  driverVehicleNumber?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
  actualDelivery?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillingInfo {
  id: string;
  orderId: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  region: string;
  country: string;
  postalCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  gateway: string;
  gatewayRef: string;
  gatewayStatus: string;
  status: string;
  method?: string;
  paymentMethod?: string;
  transactionDate?: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

export interface StatusChange {
  id: string;
  orderId: string;
  oldStatus?: string;
  newStatus: string;
  changedBy: string;
  reason?: string;
  createdAt: string;
}

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED';

export type PaymentStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export interface Order {
  id: string;
  buyerId: string;
  storeId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  subtotal: number;
  deliveryFee: number;
  taxAmount: number;
  discount: number;
  currency: string;
  checkoutSession?: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
  items: OrderItem[];
  deliveryInfo?: DeliveryInfo;
  billingInfo?: BillingInfo;
  buyer?: any;
  store?: any;
  statusHistory?: StatusChange[];
  cancelledBy?: string;
  payment?: Payment;
  paymentId?: string;
  escrow?: any;
  escrowId?: string;
  disputes?: any[];
  reviews?: any[];
  paymentMethod?: string;
}
