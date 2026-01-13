import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const pages = [];
  const maxVisible = 5;
  
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="border-white/20 bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {startPage > 1 && (
        <>
          <Button
            variant={1 === currentPage ? 'default' : 'outline'}
            onClick={() => onPageChange(1)}
            className={
              1 === currentPage
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0 shadow-lg shadow-purple-500/30'
                : 'border-white/20 bg-white/5 hover:bg-white/10 text-white backdrop-blur-sm'
            }
          >
            1
          </Button>
          {startPage > 2 && <span className="px-2 text-gray-500">...</span>}
        </>
      )}

      {pages.map((page) => (
        <Button
          key={page}
          variant={page === currentPage ? 'default' : 'outline'}
          onClick={() => onPageChange(page)}
          className={
            page === currentPage
              ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0 shadow-lg shadow-purple-500/30'
              : 'border-white/20 bg-white/5 hover:bg-white/10 text-white backdrop-blur-sm'
          }
        >
          {page}
        </Button>
      ))}

      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && <span className="px-2 text-gray-500">...</span>}
          <Button
            variant={totalPages === currentPage ? 'default' : 'outline'}
            onClick={() => onPageChange(totalPages)}
            className={
              totalPages === currentPage
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0 shadow-lg shadow-purple-500/30'
                : 'border-white/20 bg-white/5 hover:bg-white/10 text-white backdrop-blur-sm'
            }
          >
            {totalPages}
          </Button>
        </>
      )}

      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="border-white/20 bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
