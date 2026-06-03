import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

// ─── Types ───────────────────────────────────────────────────────────────────

export type Period = '7d' | '30d' | '90d' | '1y';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  cached?: boolean;
  message?: string;
}

// --- Core Dashboard ---

export interface DashboardSummary {
  totalOrders: number;
  totalRevenue: number;
  totalProducts: number;
  activeProducts: number;
  pendingOrders: number;
  confirmedOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
}

export interface SalesDataPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface SalesAnalytics {
  period: string;
  salesData: SalesDataPoint[];
}

export interface TopProduct {
  id: string;
  name: string;
  images: string[];
  price: number;
  quantityBought: number;
  stock: number;
}

export interface TopSellingProducts {
  topProducts: TopProduct[];
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface OrderAnalytics {
  statusDistribution: StatusCount[];
  paymentStatusDistribution: StatusCount[];
}

export interface StorePerformance {
  totalViews: number;
  totalOrders: number;
  conversionRate: number;
}

// --- Payments ---

export interface PaymentSummary {
  totalCollected: number;
  totalNetRevenue: number;
  pendingEscrowAmount: number;
  pendingEscrowCount: number;
  pendingPayoutAmount: number;
  pendingPayoutCount: number;
  completedPayoutAmount: number;
  completedPayoutCount: number;
  totalPlatformFeesPaid: number;
  totalPaystackFeesPaid: number;
  failedTransactions: number;
  failedPayouts: number;
  pendingTransactions: number;
  refundedAmount: number;
  refundedCount: number;
  transactionSuccessRate: number;
  successfulTransactions: number;
}

export interface PaymentMethodEntry {
  gateway: string;
  count: number;
  totalAmount: number;
  percentage: number;
}

export interface CurrencyEntry {
  currency: string;
  count: number;
  totalAmount: number;
}

export interface PaymentStatusEntry {
  status: string;
  count: number;
  totalAmount: number;
  percentage: number;
}

export interface PaymentMethodBreakdown {
  byGateway: PaymentMethodEntry[];
  byCurrency: CurrencyEntry[];
  byStatus: PaymentStatusEntry[];
  totalTransactions: number;
}

export interface PayoutOrder {
  id: string;
  totalAmount: number;
  platformFee: number;
  paystackFee: number;
  paidAt: string;
}

export interface Payout {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  transferredAt?: string;
  order: PayoutOrder;
}

export interface PayoutTimelinePoint {
  date: string;
  amount: number;
  count: number;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PayoutHistory {
  period: string;
  payouts: Payout[];
  timeline: PayoutTimelinePoint[];
  pagination: Pagination;
  summary: {
    totalPaidOut: number;
    completedPayoutCount: number;
  };
}

export interface DailyTransactionRate {
  date: string;
  success: number;
  failed: number;
  pending: number;
  refunded: number;
  total: number;
  successRate: number;
  failureRate: number;
}

export interface TransactionSuccessRate {
  period: string;
  overall: {
    successRate: number;
    failureRate: number;
    totalTransactions: number;
    successCount: number;
    failedCount: number;
  };
  dailyRates: DailyTransactionRate[];
}

export interface FailedTransaction {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  gateway: string;
  gatewayRef: string;
  createdAt: string;
  failureReason: string;
  cancelledBy: string | null;
  orderAmount: number;
  buyer: { id: string; firstName: string; email: string } | null;
}

export interface FailedTransactions {
  period: string;
  failedTransactions: FailedTransaction[];
  pagination: Pagination;
  summary: {
    totalFailed: number;
    estimatedLostRevenue: number;
  };
}

export interface EscrowRelease {
  escrowId: string;
  orderId: string;
  amountReleased: number;
  releasedAt: string;
  orderAmount: number;
}

export interface EscrowOverview {
  held: { amount: number; count: number };
  releasingSoon: { amount: number; count: number; within: string };
  released: { amount: number; count: number };
  recentReleases: EscrowRelease[];
}

export interface FeesDailyPoint {
  date: string;
  platformFee: number;
  paystackFee: number;
  grossRevenue: number;
  netRevenue: number;
}

export interface FeesAnalytics {
  period: string;
  summary: {
    totalPlatformFees: number;
    totalPaystackFees: number;
    totalFeesAllIn: number;
    grossRevenue: number;
    netRevenue: number;
    effectiveFeeRate: number;
  };
  timeline: FeesDailyPoint[];
}

// --- Products ---

export interface ProductSnapshot {
  total: number;
  active: number;
  inactive: number;
  outOfStock: number;
  lowStock: number;
  lowStockThreshold: number;
  deleted: number;
  neverSold: number;
}

export interface ProductPerformanceItem {
  id: string;
  name: string;
  images: string[];
  price: number;
  stock: number;
  isActive: boolean;
  category: string;
  createdAt: string;
  viewCount: number;
  unitsSold: number;
  quantityBoughtField: number;
  revenue: number;
  conversionRate: number;
  revenuePerView: number;
}

export interface ProductPerformance {
  products: ProductPerformanceItem[];
  pagination: Pagination;
}

export interface StockAlertProduct {
  id: string;
  name: string;
  images: string[];
  price: number;
  stock: number;
  category: string;
  quantityBought: number;
  url: string;
}

export interface StockAlerts {
  threshold: number;
  outOfStock: { count: number; products: StockAlertProduct[] };
  lowStock: { count: number; products: StockAlertProduct[] };
  totalAlerts: number;
}

export interface DeadStockProduct {
  id: string;
  name: string;
  images: string[];
  price: number;
  stock: number;
  category: string;
  totalEverSold: number;
  neverSold: boolean;
  createdAt: string;
  url: string;
  capitalTied: number;
}

export interface DeadStock {
  daysSinceLastSale: number;
  deadStock: DeadStockProduct[];
  pagination: Pagination;
  summary: {
    totalDeadStockProducts: number;
    neverSoldCount: number;
    estimatedCapitalTied: number;
  };
}

export interface RevenueProduct {
  productId: string;
  name: string;
  images: string[];
  price: number;
  category: string;
  url: string;
  unitsSold: number;
  orderCount: number;
  revenue: number;
}

export interface RevenuePerProduct {
  period: string;
  products: RevenueProduct[];
  totalRevenue: number;
}

export interface CategoryPerformanceItem {
  category: string;
  productCount: number;
  activeProductCount: number;
  unitsSold: number;
  revenue: number;
  orderItemCount: number;
  revenueShare: number;
}

export interface CategoryPerformance {
  period: string;
  categories: CategoryPerformanceItem[];
  totalRevenue: number;
  totalCategories: number;
}

export interface StockMovementPoint {
  date: string;
  unitsSold: number;
  revenue: number;
  orderLines: number;
}

export interface StockMovement {
  period: string;
  productId: string | null;
  timeline: StockMovementPoint[];
  summary: {
    totalUnitsSold: number;
    totalRevenue: number;
    averageDailySales: number;
  };
}

// --- Customers ---

export interface CustomerSnapshot {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  repeatPurchaseRate: number;
  averageLifetimeValue: number;
  averageOrdersPerCustomer: number;
}

export interface CustomerTrendPoint {
  date: string;
  newCustomers: number;
  returningCustomers: number;
  total: number;
}

export interface CustomerTrend {
  period: string;
  timeline: CustomerTrendPoint[];
}

export interface TopCustomer {
  buyerId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar: string | null;
  loyaltyPoints: number;
  totalSpend: number;
  orderCount: number;
  averageOrderValue: number;
  firstOrderAt: string;
  lastOrderAt: string;
}

export interface TopCustomers {
  period: string;
  customers: TopCustomer[];
}

export interface CLVBucket {
  range: string;
  count: number;
}

export interface CustomerLifetimeValue {
  totalCustomers: number;
  averageCLV: number;
  medianCLV: number;
  buckets: CLVBucket[];
  segments: {
    highValue: { count: number; threshold: number };
    midValue: { count: number };
    lowValue: { count: number; threshold: number };
  };
}

export interface InactiveCustomer {
  buyerId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar: string | null;
  lastOrderAt: string;
  daysSinceLastOrder: number;
  totalSpend: number;
  orderCount: number;
  averageOrderValue: number;
}

export interface InactiveCustomers {
  daysSinceLastOrder: number;
  customers: InactiveCustomer[];
  pagination: Pagination;
  summary: {
    totalInactive: number;
    estimatedLostRevenue: number;
  };
}

export interface FrequencyBucket {
  orders: string;
  customers: number;
  percentage: number;
}

export interface PurchaseFrequency {
  distribution: FrequencyBucket[];
  totalCustomers: number;
  totalOrders: number;
  averageOrdersPerCustomer: number;
}

export interface AOVPoint {
  date: string;
  aov: number;
  orderCount: number;
  uniqueBuyers: number;
  totalRevenue: number;
}

export interface AverageOrderValueTrend {
  period: string;
  overallAOV: number;
  totalOrders: number;
  totalRevenue: number;
  timeline: AOVPoint[];
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export const useSellerDashboard = () => {

  // --- Core ---
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [salesAnalytics, setSalesAnalytics] = useState<SalesAnalytics | null>(null);
  const [topProducts, setTopProducts] = useState<TopSellingProducts | null>(null);
  const [orderAnalytics, setOrderAnalytics] = useState<OrderAnalytics | null>(null);
  const [storePerformance, setStorePerformance] = useState<StorePerformance | null>(null);

  // --- Payments ---
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const [methodBreakdown, setMethodBreakdown] = useState<PaymentMethodBreakdown | null>(null);
  const [payoutHistory, setPayoutHistory] = useState<PayoutHistory | null>(null);
  const [transactionRate, setTransactionRate] = useState<TransactionSuccessRate | null>(null);
  const [failedTransactions, setFailedTransactions] = useState<FailedTransactions | null>(null);
  const [escrowOverview, setEscrowOverview] = useState<EscrowOverview | null>(null);
  const [feesAnalytics, setFeesAnalytics] = useState<FeesAnalytics | null>(null);

  // --- Products ---
  const [productSnapshot, setProductSnapshot] = useState<ProductSnapshot | null>(null);
  const [productPerformance, setProductPerformance] = useState<ProductPerformance | null>(null);
  const [stockAlerts, setStockAlerts] = useState<StockAlerts | null>(null);
  const [deadStock, setDeadStock] = useState<DeadStock | null>(null);
  const [revenuePerProduct, setRevenuePerProduct] = useState<RevenuePerProduct | null>(null);
  const [categoryPerformance, setCategoryPerformance] = useState<CategoryPerformance | null>(null);
  const [stockMovement, setStockMovement] = useState<StockMovement | null>(null);

  // --- Customers ---
  const [customerSnapshot, setCustomerSnapshot] = useState<CustomerSnapshot | null>(null);
  const [customerTrend, setCustomerTrend] = useState<CustomerTrend | null>(null);
  const [topCustomers, setTopCustomers] = useState<TopCustomers | null>(null);
  const [customerLifetimeValue, setCustomerLifetimeValue] = useState<CustomerLifetimeValue | null>(null);
  const [inactiveCustomers, setInactiveCustomers] = useState<InactiveCustomers | null>(null);
  const [purchaseFrequency, setPurchaseFrequency] = useState<PurchaseFrequency | null>(null);
  const [aovTrend, setAovTrend] = useState<AverageOrderValueTrend | null>(null);

  // --- Shared state ---
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const getAuthToken = async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem('token');
    } catch (err) {
      console.error('Error getting token from AsyncStorage:', err);
      return null;
    }
  };

  const makeAuthenticatedRequest = async <T,>(
    endpoint: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> => {
    const token = await getAuthToken();
    if (!token) throw new Error('No authentication token found');

    const response = await fetch(`${API_BASE_URL}/seller-dashboard${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Request failed');
    }

    return response.json();
  };

  const withLoadingAndError = async (fn: () => Promise<void>) => {
    try {
      setLoading(true);
      setError(null);
      await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setError(msg);
      console.error(msg, err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Core Fetchers ─────────────────────────────────────────────────────────

  const fetchSummary = useCallback(async () => {
    await withLoadingAndError(async () => {
      const res = await makeAuthenticatedRequest<DashboardSummary>('/summary');
      setSummary(res.data);
    });
  }, []);

  const fetchSalesAnalytics = useCallback(async (period: Period = '7d') => {
    await withLoadingAndError(async () => {
      const res = await makeAuthenticatedRequest<SalesAnalytics>(`/sales-analytics?period=${period}`);
      setSalesAnalytics(res.data);
    });
  }, []);

  const fetchTopProducts = useCallback(async (limit = 10) => {
    await withLoadingAndError(async () => {
      const res = await makeAuthenticatedRequest<TopSellingProducts>(`/top-products?limit=${limit}`);
      setTopProducts(res.data);
    });
  }, []);

  const fetchOrderAnalytics = useCallback(async () => {
    await withLoadingAndError(async () => {
      const res = await makeAuthenticatedRequest<OrderAnalytics>('/order-analytics');
      setOrderAnalytics(res.data);
    });
  }, []);

  const fetchStorePerformance = useCallback(async () => {
    await withLoadingAndError(async () => {
      const res = await makeAuthenticatedRequest<StorePerformance>('/store-performance');
      setStorePerformance(res.data);
    });
  }, []);

  // ─── Payment Fetchers ──────────────────────────────────────────────────────

  const fetchPaymentSummary = useCallback(async () => {
    await withLoadingAndError(async () => {
      const res = await makeAuthenticatedRequest<PaymentSummary>('/analytics/payments/summary');
      setPaymentSummary(res.data);
    });
  }, []);

  const fetchMethodBreakdown = useCallback(async () => {
    await withLoadingAndError(async () => {
      const res = await makeAuthenticatedRequest<PaymentMethodBreakdown>('/analytics/payments/methods');
      setMethodBreakdown(res.data);
    });
  }, []);

  const fetchPayoutHistory = useCallback(async (period: Period = '30d', page = 1, limit = 20) => {
    await withLoadingAndError(async () => {
      const res = await makeAuthenticatedRequest<PayoutHistory>(
        `/analytics/payments/payouts?period=${period}&page=${page}&limit=${limit}`
      );
      setPayoutHistory(res.data);
    });
  }, []);

  const fetchTransactionRate = useCallback(async (period: Period = '30d') => {
    await withLoadingAndError(async () => {
      const res = await makeAuthenticatedRequest<TransactionSuccessRate>(
        `/analytics/payments/transaction-rate?period=${period}`
      );
      setTransactionRate(res.data);
    });
  }, []);

  const fetchFailedTransactions = useCallback(async (period: Period = '30d', page = 1, limit = 20) => {
    await withLoadingAndError(async () => {
      const res = await makeAuthenticatedRequest<FailedTransactions>(
        `/analytics/payments/failed?period=${period}&page=${page}&limit=${limit}`
      );
      setFailedTransactions(res.data);
    });
  }, []);

  const fetchEscrowOverview = useCallback(async () => {
    await withLoadingAndError(async () => {
      const res = await makeAuthenticatedRequest<EscrowOverview>('/analytics/payments/escrow');
      setEscrowOverview(res.data);
    });
  }, []);

  const fetchFeesAnalytics = useCallback(async (period: Period = '30d') => {
    await withLoadingAndError(async () => {
      const res = await makeAuthenticatedRequest<FeesAnalytics>(
        `/analytics/payments/fees?period=${period}`
      );
      setFeesAnalytics(res.data);
    });
  }, []);

  // ─── Product Fetchers ──────────────────────────────────────────────────────

  const fetchProductSnapshot = useCallback(async () => {
    await withLoadingAndError(async () => {
      const res = await makeAuthenticatedRequest<ProductSnapshot>('/analytics/products/snapshot');
      setProductSnapshot(res.data);
    });
  }, []);

  const fetchProductPerformance = useCallback(async (
    page = 1,
    limit = 20,
    sortBy = 'revenue',
    sortOrder: 'asc' | 'desc' = 'desc'
  ) => {
    await withLoadingAndError(async () => {
      const res = await makeAuthenticatedRequest<ProductPerformance>(
        `/analytics/products/performance?page=${page}&limit=${limit}&sortBy=${sortBy}&sortOrder=${sortOrder}`
      );
      setProductPerformance(res.data);
    });
  }, []);

  const fetchStockAlerts = useCallback(async (threshold = 5) => {
    await withLoadingAndError(async () => {
      const res = await makeAuthenticatedRequest<StockAlerts>(
        `/analytics/products/stock-alerts?threshold=${threshold}`
      );
      setStockAlerts(res.data);
    });
  }, []);

  const fetchDeadStock = useCallback(async (daysSinceLastSale = 30, page = 1, limit = 20) => {
    await withLoadingAndError(async () => {
      const res = await makeAuthenticatedRequest<DeadStock>(
        `/analytics/products/dead-stock?daysSinceLastSale=${daysSinceLastSale}&page=${page}&limit=${limit}`
      );
      setDeadStock(res.data);
    });
  }, []);

  const fetchRevenuePerProduct = useCallback(async (period: Period = '30d', limit = 10) => {
    await withLoadingAndError(async () => {
      const res = await makeAuthenticatedRequest<RevenuePerProduct>(
        `/analytics/products/revenue?period=${period}&limit=${limit}`
      );
      setRevenuePerProduct(res.data);
    });
  }, []);

  const fetchCategoryPerformance = useCallback(async (period: Period = '30d') => {
    await withLoadingAndError(async () => {
      const res = await makeAuthenticatedRequest<CategoryPerformance>(
        `/analytics/products/categories?period=${period}`
      );
      setCategoryPerformance(res.data);
    });
  }, []);

  const fetchStockMovement = useCallback(async (period: Period = '30d', productId?: string) => {
    await withLoadingAndError(async () => {
      const query = productId
        ? `/analytics/products/stock-movement?period=${period}&productId=${productId}`
        : `/analytics/products/stock-movement?period=${period}`;
      const res = await makeAuthenticatedRequest<StockMovement>(query);
      setStockMovement(res.data);
    });
  }, []);

  // ─── Customer Fetchers ─────────────────────────────────────────────────────

  const fetchCustomerSnapshot = useCallback(async () => {
    await withLoadingAndError(async () => {
      const res = await makeAuthenticatedRequest<CustomerSnapshot>('/analytics/customers/snapshot');
      setCustomerSnapshot(res.data);
    });
  }, []);

  const fetchCustomerTrend = useCallback(async (period: Period = '30d') => {
    await withLoadingAndError(async () => {
      const res = await makeAuthenticatedRequest<CustomerTrend>(
        `/analytics/customers/trend?period=${period}`
      );
      setCustomerTrend(res.data);
    });
  }, []);

  const fetchTopCustomers = useCallback(async (limit = 10, period: Period | 'all' = 'all') => {
    await withLoadingAndError(async () => {
      const res = await makeAuthenticatedRequest<TopCustomers>(
        `/analytics/customers/top?limit=${limit}&period=${period}`
      );
      setTopCustomers(res.data);
    });
  }, []);

  const fetchCustomerLifetimeValue = useCallback(async () => {
    await withLoadingAndError(async () => {
      const res = await makeAuthenticatedRequest<CustomerLifetimeValue>('/analytics/customers/clv');
      setCustomerLifetimeValue(res.data);
    });
  }, []);

  const fetchInactiveCustomers = useCallback(async (daysSinceLastOrder = 60, page = 1, limit = 20) => {
    await withLoadingAndError(async () => {
      const res = await makeAuthenticatedRequest<InactiveCustomers>(
        `/analytics/customers/inactive?daysSinceLastOrder=${daysSinceLastOrder}&page=${page}&limit=${limit}`
      );
      setInactiveCustomers(res.data);
    });
  }, []);

  const fetchPurchaseFrequency = useCallback(async () => {
    await withLoadingAndError(async () => {
      const res = await makeAuthenticatedRequest<PurchaseFrequency>('/analytics/customers/frequency');
      setPurchaseFrequency(res.data);
    });
  }, []);

  const fetchAOVTrend = useCallback(async (period: Period = '30d') => {
    await withLoadingAndError(async () => {
      const res = await makeAuthenticatedRequest<AverageOrderValueTrend>(
        `/analytics/customers/aov?period=${period}`
      );
      setAovTrend(res.data);
    });
  }, []);

  // ─── Grouped Refresh Helpers ───────────────────────────────────────────────

  const refreshCoreDashboard = useCallback(async (period: Period = '7d') => {
    await Promise.all([
      fetchSummary(),
      fetchSalesAnalytics(period),
      fetchTopProducts(),
      fetchOrderAnalytics(),
      fetchStorePerformance(),
    ]);
  }, [fetchSummary, fetchSalesAnalytics, fetchTopProducts, fetchOrderAnalytics, fetchStorePerformance]);

  const refreshPaymentAnalytics = useCallback(async (period: Period = '30d') => {
    await Promise.all([
      fetchPaymentSummary(),
      fetchMethodBreakdown(),
      fetchPayoutHistory(period),
      fetchTransactionRate(period),
      fetchFailedTransactions(period),
      fetchEscrowOverview(),
      fetchFeesAnalytics(period),
    ]);
  }, [fetchPaymentSummary, fetchMethodBreakdown, fetchPayoutHistory, fetchTransactionRate, fetchFailedTransactions, fetchEscrowOverview, fetchFeesAnalytics]);

  const refreshProductAnalytics = useCallback(async (period: Period = '30d') => {
    await Promise.all([
      fetchProductSnapshot(),
      fetchProductPerformance(),
      fetchStockAlerts(),
      fetchDeadStock(),
      fetchRevenuePerProduct(period),
      fetchCategoryPerformance(period),
      fetchStockMovement(period),
    ]);
  }, [fetchProductSnapshot, fetchProductPerformance, fetchStockAlerts, fetchDeadStock, fetchRevenuePerProduct, fetchCategoryPerformance, fetchStockMovement]);

  const refreshCustomerAnalytics = useCallback(async (period: Period = '30d') => {
    await Promise.all([
      fetchCustomerSnapshot(),
      fetchCustomerTrend(period),
      fetchTopCustomers(),
      fetchCustomerLifetimeValue(),
      fetchInactiveCustomers(),
      fetchPurchaseFrequency(),
      fetchAOVTrend(period),
    ]);
  }, [fetchCustomerSnapshot, fetchCustomerTrend, fetchTopCustomers, fetchCustomerLifetimeValue, fetchInactiveCustomers, fetchPurchaseFrequency, fetchAOVTrend]);

  const refreshAll = useCallback(async (period: Period = '30d') => {
    await Promise.all([
      refreshCoreDashboard(),
      refreshPaymentAnalytics(period),
      refreshProductAnalytics(period),
      refreshCustomerAnalytics(period),
    ]);
  }, [refreshCoreDashboard, refreshPaymentAnalytics, refreshProductAnalytics, refreshCustomerAnalytics]);

  // ─── Return ────────────────────────────────────────────────────────────────

  return {
    // State
    loading,
    error,

    // Core
    summary,
    salesAnalytics,
    topProducts,
    orderAnalytics,
    storePerformance,

    // Payments
    paymentSummary,
    methodBreakdown,
    payoutHistory,
    transactionRate,
    failedTransactions,
    escrowOverview,
    feesAnalytics,

    // Products
    productSnapshot,
    productPerformance,
    stockAlerts,
    deadStock,
    revenuePerProduct,
    categoryPerformance,
    stockMovement,

    // Customers
    customerSnapshot,
    customerTrend,
    topCustomers,
    customerLifetimeValue,
    inactiveCustomers,
    purchaseFrequency,
    aovTrend,

    // Core fetchers
    fetchSummary,
    fetchSalesAnalytics,
    fetchTopProducts,
    fetchOrderAnalytics,
    fetchStorePerformance,

    // Payment fetchers
    fetchPaymentSummary,
    fetchMethodBreakdown,
    fetchPayoutHistory,
    fetchTransactionRate,
    fetchFailedTransactions,
    fetchEscrowOverview,
    fetchFeesAnalytics,

    // Product fetchers
    fetchProductSnapshot,
    fetchProductPerformance,
    fetchStockAlerts,
    fetchDeadStock,
    fetchRevenuePerProduct,
    fetchCategoryPerformance,
    fetchStockMovement,

    // Customer fetchers
    fetchCustomerSnapshot,
    fetchCustomerTrend,
    fetchTopCustomers,
    fetchCustomerLifetimeValue,
    fetchInactiveCustomers,
    fetchPurchaseFrequency,
    fetchAOVTrend,

    // Grouped refresh helpers
    refreshCoreDashboard,
    refreshPaymentAnalytics,
    refreshProductAnalytics,
    refreshCustomerAnalytics,
    refreshAll,
  };
};