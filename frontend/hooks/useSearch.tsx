import { useState, useEffect, useCallback } from 'react';

// Types
export type SearchType = 'all' | 'product' | 'store';

export interface Store {
  id: string;
  name: string;
  url: string;
  logo: string | null;
}

export interface Product {
  type: 'product';
  id: string;
  name: string;
  description: string | null;
  price: number;
  images: string[];
  category: string | null;
  tags: string[];
  url: string;
  store: Store;
}

export interface StoreResult {
  type: 'store';
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  location: string | null;
  category: string | null;
  url: string;
  rating: number | null;
  totalReviews: number;
  viewCount: number;
}

export type SearchResult = Product | StoreResult;

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface SearchFilters {
  q: string;
  type: SearchType;
}

export interface SearchResponse {
  success: boolean;
  results: SearchResult[];
  pagination: Pagination;
  filters: SearchFilters;
  cached?: boolean;
  message?: string;
  error?: string;
}

export interface UseUnifiedSearchOptions {
  baseUrl?: string;
  limit?: number;
  type?: SearchType;
  enabled?: boolean;
  debounceMs?: number;
}

export interface UseUnifiedSearchReturn {
  data: SearchResponse | null;
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  search: (query: string) => void;
  loadMore: () => void;
  setType: (type: SearchType) => void;
  clear: () => void;
  hasMore: boolean;
}

export const useUnifiedSearch = (
  initialQuery: string = '',
  options: UseUnifiedSearchOptions = {}
): UseUnifiedSearchReturn => {
  const {
    baseUrl = '/',
    limit = 10,
    type: initialType = 'all',
    enabled = true,
    debounceMs = 300
  } = options;

  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState<SearchType>(initialType);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const fetchSearch = useCallback(async (
    searchQuery: string,
    searchPage: number,
    searchType: SearchType,
    append: boolean = false
  ) => {
    if (!searchQuery.trim() || !enabled) {
      setData(null);
      return;
    }

    try {
      setIsLoading(true);
      setIsError(false);
      setError(null);

      const params = new URLSearchParams({
        q: searchQuery.trim(),
        page: searchPage.toString(),
        limit: limit.toString(),
        type: searchType
      });

      const response = await fetch(`${baseUrl}/search?${params.toString()}`);
      const result: SearchResponse = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Search failed');
      }

      setData(prevData => {
        if (append && prevData) {
          return {
            ...result,
            results: [...prevData.results, ...result.results]
          };
        }
        return result;
      });
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl, limit, enabled]);

  const search = useCallback((newQuery: string) => {
    setQuery(newQuery);
    setPage(1);
    
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    if (!newQuery.trim()) {
      setData(null);
      return;
    }

    const timer = setTimeout(() => {
      fetchSearch(newQuery, 1, type, false);
    }, debounceMs);

    setDebounceTimer(timer);
  }, [debounceTimer, debounceMs, fetchSearch, type]);

  const loadMore = useCallback(() => {
    if (!data || isLoading) return;
    
    const nextPage = page + 1;
    if (nextPage <= data.pagination.pages) {
      setPage(nextPage);
      fetchSearch(query, nextPage, type, true);
    }
  }, [data, isLoading, page, query, type, fetchSearch]);

  const handleSetType = useCallback((newType: SearchType) => {
    setType(newType);
    setPage(1);
    if (query.trim()) {
      fetchSearch(query, 1, newType, false);
    }
  }, [query, fetchSearch]);

  const clear = useCallback(() => {
    setQuery('');
    setPage(1);
    setData(null);
    setIsError(false);
    setError(null);
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  }, [debounceTimer]);

  useEffect(() => {
    if (initialQuery.trim() && enabled) {
      fetchSearch(initialQuery, 1, type, false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  const hasMore = data ? page < data.pagination.pages : false;

  return {
    data,
    isLoading,
    isError,
    error,
    search,
    loadMore,
    setType: handleSetType,
    clear,
    hasMore
  };
};