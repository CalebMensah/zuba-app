import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import {
  productAPI,
  Product,
  CreateProductData,
  UpdateProductData,
  ProductFilters,
  TopSellingFilters,
  RecommendedFilters,
  YouMayLikeFilters,
  TrendingFilters,
} from '../services/productApi';

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters?: ProductFilters) => [...productKeys.lists(), filters] as const,
  userProducts: (page?: number, limit?: number) =>
    [...productKeys.all, 'user', page, limit] as const,
  storeProducts: (storeUrl: string, filters?: ProductFilters) =>
    [...productKeys.all, 'store', storeUrl, filters] as const,
  detail: (url: string) => [...productKeys.all, 'detail', url] as const,
  deleted: () => [...productKeys.all, 'deleted'] as const,
  topSelling: (filters?: TopSellingFilters) =>
    [...productKeys.all, 'top-selling', filters] as const,
  recommended: (productUrl: string, filters?: RecommendedFilters) =>
    [...productKeys.all, 'recommended', productUrl, filters] as const,
  youMayLike: (filters?: YouMayLikeFilters) =>
    [...productKeys.all, 'you-may-like', filters] as const,
  trending: (filters?: TrendingFilters) =>
    [...productKeys.all, 'trending', filters] as const,
};

export const useUserProducts = (page: number = 1, limit: number = 20) => {
  return useQuery({
    queryKey: productKeys.userProducts(page, limit),
    queryFn: () => productAPI.getUserProducts(page, limit),
    staleTime: 0,
  });
};

export const useAllProducts = (filters?: ProductFilters) => {
  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: () => productAPI.getAllProducts(filters),
    staleTime: 60000,
  });
};

export const useStoreProducts = (storeUrl: string, filters?: ProductFilters) => {
  return useQuery({
    queryKey: productKeys.storeProducts(storeUrl, filters),
    queryFn: () => productAPI.getStoreProducts(storeUrl, filters),
    enabled: !!storeUrl,
    staleTime: 60000,
  });
};

export const useProduct = (productUrl: string) => {
  return useQuery({
    queryKey: productKeys.detail(productUrl),
    queryFn: () => productAPI.getProductByUrl(productUrl),
    enabled: !!productUrl,
    staleTime: 120000,
  });
};

export const useDeletedProducts = () => {
  return useQuery({
    queryKey: productKeys.deleted(),
    queryFn: () => productAPI.getDeletedProducts(),
    staleTime: 0,
  });
};

export const useTopSellingProducts = (filters?: TopSellingFilters) => {
  return useQuery({
    queryKey: productKeys.topSelling(filters),
    queryFn: () => productAPI.getTopSellingProducts(filters),
    staleTime: 300000,
  });
};

export const useRecommendedProducts = (productUrl: string, filters?: RecommendedFilters) => {
  return useQuery({
    queryKey: productKeys.recommended(productUrl, filters),
    queryFn: () => productAPI.getRecommendedProducts(productUrl, filters),
    enabled: !!productUrl,
    staleTime: 300000,
  });
};

export const useYouMayLikeProducts = (filters?: YouMayLikeFilters) => {
  return useQuery({
    queryKey: productKeys.youMayLike(filters),
    queryFn: () => productAPI.getProductsYouMayLike(filters),
    staleTime: 300000,
  });
};

export const useTrendingProducts = (filters?: TrendingFilters) => {
  return useQuery({
    queryKey: productKeys.trending(filters),
    queryFn: () => productAPI.getTrendingProducts(filters),
    staleTime: 300000,
  });
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productData: CreateProductData) => productAPI.createProduct(productData),

    onMutate: async (newProductData) => {
      await queryClient.cancelQueries({ queryKey: productKeys.userProducts() });

      const previousProducts = queryClient.getQueryData(productKeys.userProducts(1, 20));

      const tempProduct: Product = {
        id: 'temp-' + Date.now(),
        storeId: 'temp-store',
        name: newProductData.name,
        description: newProductData.description,
        price: newProductData.price,
        stock: newProductData.stock,
        images: newProductData.images?.map(img => img.uri) || [],
        category: newProductData.category,
        tags: newProductData.tags || [],
        sizes: newProductData.sizes || [],
        color: newProductData.color || [],
        moq: newProductData.moq,
        url: 'temp-url',
        isActive: true,
        quantityBought: 0,
        viewCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData(productKeys.userProducts(1, 20), (old: any) => {
        if (!old) return { products: [tempProduct], pagination: { page: 1, limit: 20, total: 1, pages: 1 } };
        return {
          ...old,
          products: [tempProduct, ...old.products],
          pagination: { ...old.pagination, total: old.pagination.total + 1 },
        };
      });

      return { previousProducts };
    },

    onError: (err, newProduct, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(productKeys.userProducts(1, 20), context.previousProducts);
      }
      console.error('Create product error:', err);
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.userProducts() });
      queryClient.invalidateQueries({ queryKey: productKeys.userProducts(1, 20) });
    },
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, updateData }: { productId: string; updateData: UpdateProductData }) =>
      productAPI.updateProduct(productId, updateData),

    onMutate: async ({ productId, updateData }) => {
      await queryClient.cancelQueries({ queryKey: productKeys.userProducts() });
      const previousProducts = queryClient.getQueryData(productKeys.userProducts(1, 20));

      queryClient.setQueryData(productKeys.userProducts(1, 20), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          products: old.products.map((p: Product) =>
            p.id === productId ? { ...p, ...updateData, updatedAt: new Date().toISOString() } : p
          ),
        };
      });

      return { previousProducts };
    },

    onError: (err, variables, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(productKeys.userProducts(1, 20), context.previousProducts);
      }
      console.error('Update product error:', err);
    },

    onSuccess: (data) => {
      queryClient.setQueryData(productKeys.detail(data.url), data);
      queryClient.invalidateQueries({ queryKey: productKeys.userProducts() });
      queryClient.invalidateQueries({ queryKey: productKeys.userProducts(1, 20) });
    },
  });
};

export const useSoftDeleteProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: string) => productAPI.softDeleteProduct(productId),

    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: productKeys.userProducts() });
      const previousProducts = queryClient.getQueryData(productKeys.userProducts(1, 20));

      queryClient.setQueryData(productKeys.userProducts(1, 20), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          products: old.products.filter((p: Product) => p.id !== productId),
          pagination: { ...old.pagination, total: old.pagination.total - 1 },
        };
      });

      return { previousProducts };
    },

    onError: (err, productId, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(productKeys.userProducts(1, 20), context.previousProducts);
      }
      Alert.alert('Error', 'Failed to delete product. Please try again.');
      console.error('Delete product error:', err);
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.deleted() });
      queryClient.invalidateQueries({ queryKey: productKeys.userProducts() });
      queryClient.invalidateQueries({ queryKey: productKeys.userProducts(1, 20) });
    },
  });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: string) => productAPI.deleteProduct(productId),

    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: productKeys.deleted() });
      const previousDeletedProducts = queryClient.getQueryData(productKeys.deleted());

      queryClient.setQueryData(productKeys.deleted(), (old: Product[] | undefined) => {
        if (!old) return old;
        return old.filter((p: Product) => p.id !== productId);
      });

      return { previousDeletedProducts };
    },

    onError: (err, productId, context) => {
      if (context?.previousDeletedProducts) {
        queryClient.setQueryData(productKeys.deleted(), context.previousDeletedProducts);
      }
      Alert.alert('Error', 'Failed to permanently delete product.');
      console.error('Hard delete product error:', err);
    },
  });
};

export const useRestoreProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: string) => productAPI.restoreProduct(productId),

    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: productKeys.deleted() });
      const previousDeletedProducts = queryClient.getQueryData(productKeys.deleted());

      queryClient.setQueryData(productKeys.deleted(), (old: Product[] | undefined) => {
        if (!old) return old;
        return old.filter((p: Product) => p.id !== productId);
      });

      return { previousDeletedProducts };
    },

    onError: (err, productId, context) => {
      if (context?.previousDeletedProducts) {
        queryClient.setQueryData(productKeys.deleted(), context.previousDeletedProducts);
      }
      Alert.alert('Error', 'Failed to restore product.');
      console.error('Restore product error:', err);
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.userProducts() });
      queryClient.invalidateQueries({ queryKey: productKeys.userProducts(1, 20) });
    },
  });
};

export const useInvalidateProducts = () => {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: productKeys.all });
  };
};

export const usePrefetchUserProducts = () => {
  const queryClient = useQueryClient();
  return (page: number = 1, limit: number = 20) => {
    queryClient.prefetchQuery({
      queryKey: productKeys.userProducts(page, limit),
      queryFn: () => productAPI.getUserProducts(page, limit),
    });
  };
};