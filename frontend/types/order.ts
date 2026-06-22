export type DeliveryStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'FAILED'
  | 'RETURNED';

export type DeliveryMethod =
  | 'SELLER_DELIVERY'
  | 'BOLT_DISPATCH'
  | 'BUS_TRANSPORT'
  | 'PICKUP'
  | 'THIRD_PARTY_RIDER'
  | 'OTHER';

export type DeliveryProofType =
  | 'HANDOVER_PHOTO'
  | 'WAYBILL'
  | 'DISPATCH_RECEIPT'
  | 'DELIVERY_PHOTO'
  | 'BUYER_SIGNATURE'
  | 'OTP_CONFIRMATION';

export type DeliveryActor = 'SELLER' | 'BUYER' | 'SYSTEM' | 'ADMIN';

export interface DeliveryProof {
  id: string;
  deliveryId: string;
  type: DeliveryProofType;
  fileUrl: string;
  note?: string | null;
  uploadedById?: string | null;
  uploadedRole: DeliveryActor;
  createdAt: string;
}

export interface DeliveryInfo {
  id: string;
  orderId: string;
  recipient: string;
  phone: string;
  address: string;
  emnail?: string | null;
  city: string;
  region: string;
  postalCode?: string | null;
  country: string;
  deliveryMethod: DeliveryMethod;
  deliveryFee?: number | null;
  estimatedDeliveryDays?: number | null;
  dispatchNote?: string | null;
  status: DeliveryStatus;
  courierService?: string | null;
  trackingNumber?: string | null;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  buyerConfirmedAt?: string | null;
  autoReleasedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  deliveryProofs?: DeliveryProof[];
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
  deliveryMethod: DeliveryMethod;
  deliveryFee?: number;
  notes?: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  price: number;
  unitPrice?: number;
  total: number;
  commission: number;
  size?: string;
  color?: string;
  createdAt: string;
  name?: string;
  productName?: string;
  product?: {
    id: string;
    name: string;
    images: string[];
    [key: string]: any;
  };
  paymentMethod?: string;
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

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'COMPLETED'
  | 'DISPUTED'
  | 'CANCELLED'
  | 'REFUNDED';

export type PaymentStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export interface StatusChange {
  id: string;
  orderId: string;
  oldStatus?: string;
  newStatus: string;
  changedBy: string;
  reason?: string;
  createdAt: string;
}

export interface OrderBreakdown {
  subtotal: number;
  deliveryFee: number;
  taxAmount: number;
  discount: number;
  orderSubtotal: number;
  paystackCollectionFee: number;
  buyerTotal: number;
  commissionTotal: number;
  transferFee: number;
  grossSellerPayout: number;
  netSellerPayout: number;
  refundAmount: number;
  platformFee: number;
  paystackFee: number;
}

export interface OrderStore {
  id: string;
  name: string;
  url?: string;
  logo?: string;
  userId: string;
}

export interface Order {
  id: string;
  buyerId: string;
  storeId: string;
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
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
  refundAmount?: number;
  paymentMethod?: string;
  cancelledBy?: string;
  items: OrderItem[];
  deliveryInfo?: DeliveryInfo;
  billingInfo?: BillingInfo;
  buyer?: any;
  store?: OrderStore;
  statusHistory?: StatusChange[];
  payment?: Payment[];
  paymentId?: string;
  escrow?: any;
  escrowId?: string;
  disputes?: any[];
  reviews?: any[];
}

export interface OrderWithBreakdown extends Order {
  buyerTotalAmount: number;
  breakdown: OrderBreakdown;
}

export interface OrdersResponse {
  orders: OrderWithBreakdown[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface CreateOrderData {
  items: {
    productId: string;
    quantity: number;
    price: number;
    size?: string;
    color?: string;
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

export interface CreateOrderResponse {
  orders: OrderWithBreakdown[];
  sellerPayouts: {
    sellerId: string;
    orderId: string;
    orderSubtotal: number;
    paystackCollectionFee: number;
    buyerTotalAmount: number;
    totalRevenue: number;
    commissionTotal: number;
    grossPayoutAmount: number;
    transferFee: number;
    netPayoutAmount: number;
    payoutPreference: string;
  }[];
}

export interface RejectOrderResponse {
  orderId: string;
  status: string;
  paymentStatus: string;
  refundAmount: number;
  refundReason: string;
  refundProcessed: boolean;
  refundData: any;
}

export interface UnpaidOrdersSummary {
  totalUnpaidOrders: number;
  totalAmount: number;
  totalItems: number;
  uniqueStores: number;
  currency: string;
  oldestUnpaidOrder: {
    id: string;
    createdAt: string;
    amount: number;
  } | null;
  hasUnpaidOrders: boolean;
}

export interface UnpaidOrdersResponse {
  orders: OrderWithBreakdown[];
  ordersByStore: {
    store: any;
    orders: OrderWithBreakdown[];
    storeTotal: number;
  }[];
  summary: {
    totalUnpaidOrders: number;
    totalAmount: number;
    totalItems: number;
    uniqueStores: number;
    currency: string;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface UnpaidOrderDetails extends OrderWithBreakdown {
  hasUnavailableItems: boolean;
  unavailableItems: {
    productId: string;
    productName: string;
    requestedQuantity: number;
    availableStock: number;
  }[];
}

export interface StoreGroup {
  store: any;
  orders: OrderWithBreakdown[];
  orderCount: number;
  totalAmount: number;
  totalItems: number;
  currency: string;
}

export interface UnpaidOrdersByStoreResponse {
  storeGroups: StoreGroup[];
  summary: {
    totalStores: number;
    totalOrders: number;
    grandTotal: number;
    currency: string;
  };
}

export interface OrderFilters {
  page?: number;
  limit?: number;
  status?: string;
  paymentStatus?: PaymentStatus;
  sortBy?: 'createdAt' | 'totalAmount' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  storeId?: string;
}