import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { orderAPI } from '../services/orderApi';
import {
  Order,
  OrderWithBreakdown,
  CreateOrderData,
  OrderFilters,
} from '../types/order';

// Inline mutation arg types
type UpdateOrderStatusArg = { orderId: string; status: string; reason?: string };
type UpdateCheckoutSessionArg = {
  orderId: string;
  checkoutSession: string;
  paymentStatus?: string;
  paymentRef?: string;
};
type CancelOrderArg = { orderId: string; reason?: string };
type RejectOrderArg = { orderId: string; reason: string };
type CancelUnpaidOrderArg = string;

// Export types used by components
export type { OrderWithBreakdown };

// Query Keys
export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  buyerOrders: (filters?: OrderFilters) => [...orderKeys.lists(), 'buyer', filters] as const,
  sellerOrders: (filters?: OrderFilters) => [...orderKeys.lists(), 'seller', filters] as const,
  detail: (orderId: string) => [...orderKeys.all, 'detail', orderId] as const,
  checkoutSession: (sessionId: string) => [...orderKeys.all, 'checkout', sessionId] as const,
  unpaid: () => [...orderKeys.all, 'unpaid'] as const,
  unpaidList: (filters?: OrderFilters) => [...orderKeys.unpaid(), 'list', filters] as const,
  unpaidSummary: () => [...orderKeys.unpaid(), 'summary'] as const,
  unpaidByStore: () => [...orderKeys.unpaid(), 'by-store'] as const,
  unpaidDetail: (orderId: string) => [...orderKeys.unpaid(), 'detail', orderId] as const,
};

// Queries
export const useBuyerOrders = (filters?: OrderFilters) => useQuery({
  queryKey: orderKeys.buyerOrders(filters),
  queryFn: () => orderAPI.getBuyerOrders(filters),
  staleTime: 30000,
});

export const useSellerOrders = (filters?: OrderFilters) => useQuery({
  queryKey: orderKeys.sellerOrders(filters),
  queryFn: () => orderAPI.getSellerOrders(filters),
  staleTime: 30000,
});

export const useOrder = (orderId: string) => useQuery({
  queryKey: orderKeys.detail(orderId),
  queryFn: () => orderAPI.getOrderById(orderId),
  enabled: !!orderId,
  staleTime: 60000,
});

export const useOrderByCheckoutSession = (sessionId: string) => useQuery({
  queryKey: orderKeys.checkoutSession(sessionId),
  queryFn: () => orderAPI.getOrderByCheckoutSession(sessionId),
  enabled: !!sessionId,
  staleTime: 60000,
});

export const useUnpaidOrders = (filters?: OrderFilters) => useQuery({
  queryKey: orderKeys.unpaidList(filters),
  queryFn: () => orderAPI.getUnpaidOrders(filters),
  staleTime: 30000,
});

export const useUnpaidOrdersSummary = () => useQuery({
  queryKey: orderKeys.unpaidSummary(),
  queryFn: () => orderAPI.getUnpaidOrdersSummary(),
  staleTime: 60000,
});

export const useUnpaidOrdersByStore = () => useQuery({
  queryKey: orderKeys.unpaidByStore(),
  queryFn: () => orderAPI.getUnpaidOrdersByStore(),
  staleTime: 60000,
});

export const useUnpaidOrder = (orderId: string) => useQuery({
  queryKey: orderKeys.unpaidDetail(orderId),
  queryFn: () => orderAPI.getUnpaidOrderById(orderId),
  enabled: !!orderId,
  staleTime: 60000,
});

// Mutations - Fixed typing
export const useCreateOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderData: CreateOrderData) => orderAPI.createOrder(orderData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: orderKeys.unpaid() });
    },
    onError: (error) => {
      Alert.alert('Error', (error as Error).message || 'Failed to create order');
    },
  });
};

export const useUpdateOrderStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status, reason }: UpdateOrderStatusArg) =>
      orderAPI.updateOrderStatus(orderId, status, reason),
    onSuccess: (data, { orderId }: UpdateOrderStatusArg) => {
      queryClient.setQueryData(orderKeys.detail(orderId), data);
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
    onError: (error) => {
      Alert.alert('Error', (error as Error).message || 'Failed to update order status');
    },
  });
};

export const useUpdateCheckoutSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, checkoutSession, paymentStatus, paymentRef }: UpdateCheckoutSessionArg) =>
      orderAPI.updateCheckoutSession(orderId, checkoutSession, paymentStatus, paymentRef),
    onSuccess: (data, { orderId }: UpdateCheckoutSessionArg) => {
      queryClient.setQueryData(orderKeys.detail(orderId), data);
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
    onError: (error) => {
      Alert.alert('Error', (error as Error).message || 'Failed to update checkout session');
    },
  });
};

export const useCancelOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason }: CancelOrderArg) => orderAPI.cancelOrder(orderId, reason),
    onMutate: async (variables: CancelOrderArg) => {
      const { orderId } = variables;
      await queryClient.cancelQueries({ queryKey: orderKeys.lists() });
      const previousOrder = queryClient.getQueryData(orderKeys.detail(orderId));
      queryClient.setQueryData(orderKeys.detail(orderId), (old: any) => ({
        ...old,
        status: 'CANCELLED',
        cancelledAt: new Date().toISOString(),
      }));
      return { previousOrder };
    },
    onError: (err: any, variables: CancelOrderArg, context: any) => {
      const { orderId } = variables;
      if ((context as any)?.previousOrder) {
        queryClient.setQueryData(orderKeys.detail(orderId), (context as any).previousOrder);
      }
      Alert.alert('Error', (err as Error).message || 'Failed to cancel order');
    },
    onSettled: (data: any, error: any, variables: CancelOrderArg, context: any) => {
      const { orderId } = variables;
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
      if (data) {
        queryClient.setQueryData(orderKeys.detail(orderId), data);
      }
    },
  });


};

export const useAcceptOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => orderAPI.acceptOrder(orderId),
    onSuccess: (data, orderId: string) => {
      queryClient.setQueryData(orderKeys.detail(orderId), data);
      queryClient.invalidateQueries({ queryKey: orderKeys.sellerOrders() });
    },
    onError: (error) => {
      Alert.alert('Error', (error as Error).message || 'Failed to accept order');
    },
  });
};

export const useRejectOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason }: RejectOrderArg) => orderAPI.rejectOrder(orderId, reason),
    onSuccess: (_data, { orderId }: RejectOrderArg) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      queryClient.invalidateQueries({ queryKey: orderKeys.sellerOrders() });
    },
    onError: (error) => {
      Alert.alert('Error', (error as Error).message || 'Failed to reject order');
    },
  });
};

export const useCancelUnpaidOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => orderAPI.cancelUnpaidOrder(orderId),
    onMutate: async (orderId: string) => {
      await queryClient.cancelQueries({ queryKey: orderKeys.unpaid() });
      const previousLists = queryClient.getQueryData(orderKeys.unpaidList());
      const previousSummary = queryClient.getQueryData(orderKeys.unpaidSummary());
      
      const currentUnpaidList = queryClient.getQueryData(orderKeys.unpaidList()) as any;
      if (currentUnpaidList?.orders) {
        queryClient.setQueryData(orderKeys.unpaidList(), {
          ...currentUnpaidList,
          orders: currentUnpaidList.orders.filter((order: any) => order.id !== orderId),
        });
      }
      
      const currentSummary = queryClient.getQueryData(orderKeys.unpaidSummary()) as any;
      if (currentSummary) {
        queryClient.setQueryData(orderKeys.unpaidSummary(), {
          ...currentSummary,
          totalUnpaidOrders: Math.max(0, (currentSummary.totalUnpaidOrders || 0) - 1),
          totalAmount: Math.max(0, (currentSummary.totalAmount || 0) - 100),
        });
      }
      
      return { previousLists, previousSummary };
    },
    onError: (err, orderId: string, context?: { previousLists?: any; previousSummary?: any }) => {
      if (context?.previousLists) {
        queryClient.setQueryData(orderKeys.unpaidList(), context.previousLists);
      }
      if (context?.previousSummary) {
        queryClient.setQueryData(orderKeys.unpaidSummary(), context.previousSummary);
      }
      Alert.alert('Error', (err as Error).message || 'Failed to cancel unpaid order');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.unpaid() });
    },
  });
};

// Helper utilities
export const formatCurrency = (amount: number, currency: string = 'GHS'): string => {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

export const calculateOrderTotals = (order: OrderWithBreakdown) => {
  return {
    subtotal: order.breakdown.subtotal,
    fees: order.breakdown.deliveryFee + order.breakdown.taxAmount,
    discount: order.breakdown.discount,
    orderSubtotal: order.breakdown.orderSubtotal,
    paystackCollectionFee: order.breakdown.paystackCollectionFee,
    buyerTotal: order.breakdown.buyerTotal,
    commissionTotal: order.breakdown.commissionTotal,
    transferFee: order.breakdown.transferFee,
    grossSellerPayout: order.breakdown.grossSellerPayout,
    netSellerPayout: order.breakdown.netSellerPayout,
    formatted: {
      subtotal: formatCurrency(order.breakdown.subtotal, order.currency),
      fees: formatCurrency(
        order.breakdown.deliveryFee + order.breakdown.taxAmount,
        order.currency
      ),
      discount: formatCurrency(order.breakdown.discount, order.currency),
      orderSubtotal: formatCurrency(order.breakdown.orderSubtotal, order.currency),
      paystackCollectionFee: formatCurrency(order.breakdown.paystackCollectionFee, order.currency),
      buyerTotal: formatCurrency(order.breakdown.buyerTotal, order.currency),
      commissionTotal: formatCurrency(order.breakdown.commissionTotal, order.currency),
      transferFee: formatCurrency(order.breakdown.transferFee, order.currency),
      grossSellerPayout: formatCurrency(order.breakdown.grossSellerPayout, order.currency),
      netSellerPayout: formatCurrency(order.breakdown.netSellerPayout, order.currency),
    },
  };
};

export const canCancelOrder = (order: Order, userRole: 'buyer' | 'seller'): boolean => {
  if (userRole === 'buyer') {
    return order.status === 'PENDING_PAYMENT';
  }
  if (userRole === 'seller') {
    return order.status ? ['PENDING', 'CONFIRMED'].includes(order.status) : false;
  }
  return false;
};

export const useInvalidateOrders = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orderKeys.all });
};

export const usePrefetchBuyerOrders = () => {
  const queryClient = useQueryClient();
  return (filters?: OrderFilters) => {
    queryClient.prefetchQuery({
      queryKey: orderKeys.buyerOrders(filters),
      queryFn: () => orderAPI.getBuyerOrders(filters),
    });
  };
};

