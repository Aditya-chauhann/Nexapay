import { useState, useMemo } from 'react';

export interface UsePaginationReturn<T> {
  currentPage: number;
  totalPages: number;
  paginatedData: T[];
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
}

export function usePagination<T>(data: T[], itemsPerPage: number = 10): UsePaginationReturn<T> {
  const [currentPage, setCurrentPage] = useState(1);

  // Ensure current page is valid when data changes
  const totalPages = Math.max(1, Math.ceil(data.length / itemsPerPage));
  const validPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedData = useMemo(() => {
    const startIndex = (validPage - 1) * itemsPerPage;
    return data.slice(startIndex, startIndex + itemsPerPage);
  }, [data, validPage, itemsPerPage]);

  const setPage = (page: number) => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages));
  };

  const nextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const prevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  // Keep internal state in sync with validPage to prevent bugs when switching filters
  if (currentPage !== validPage) {
    setCurrentPage(validPage);
  }

  return {
    currentPage: validPage,
    totalPages,
    paginatedData,
    setPage,
    nextPage,
    prevPage,
  };
}
