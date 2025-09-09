import { 
  Table,
  TableHeader, 
  TableHead, 
  TableBody, 
  TableRow, 
  TableCell
} from '@/components/ui/table';

interface TablePlaceholderProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
}

export function TablePlaceholder({ 
  rows = 5, 
  columns = 3, 
  showHeader = true, 
  className = "" 
}: TablePlaceholderProps) {
  return (
    <div className={`border border-border rounded-lg bg-background shadow-sm overflow-hidden ${className}`}>
      <Table className="w-full">
        {showHeader && (
          <TableHeader>
            <TableRow>
              {Array.from({ length: columns }).map((_, index) => (
                <TableHead key={index} className="h-12">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        )}
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <TableCell key={colIndex} className="h-12">
                  <div 
                    className={`h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse ${
                      colIndex === 0 ? 'w-3/4' : colIndex === columns - 1 ? 'w-1/2' : 'w-full'
                    }`} 
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface UsersTablePlaceholderProps {
  className?: string;
}

export function UsersTablePlaceholder({ className = "" }: UsersTablePlaceholderProps) {
  return (
    <div className={`border border-border rounded-lg bg-background shadow-sm overflow-hidden ${className}`}>
      <Table className="w-full">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-16" />
            </TableHead>
            <TableHead className="w-[300px]">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-12" />
            </TableHead>
            <TableHead className="w-[200px]">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-24" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 15 }).map((_, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20" />
                </div>
              </TableCell>
              <TableCell>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-48" />
              </TableCell>
              <TableCell>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-32" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {/* Pagination Placeholder */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-32" />
        <div className="flex items-center gap-2">
          <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="flex gap-1">
            {[1, 2, 3].map((page) => (
              <div key={page} className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ))}
          </div>
          <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

interface TestsListPlaceholderProps {
  className?: string;
}

export function TestsListPlaceholder({ className = "" }: TestsListPlaceholderProps) {
  return (
    <div className={`container mx-auto px-0 md:px-8 ${className}`}>
      <div className="flex flex-col">
        <div className="h-px bg-border" />
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index}>
            <div className="grid items-center gap-4 px-4 py-5 md:grid-cols-4">
              <div className="order-2 flex items-center gap-2 md:order-none">
                <span className="flex h-14 w-16 shrink-0 items-center justify-center rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="flex flex-col gap-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-32" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-24" />
                </div>
              </div>
              <div className="order-1 md:order-none md:col-span-2">
                <div className="space-y-2">
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
                </div>
              </div>
              <div className="order-3 ml-auto w-fit md:order-none">
                <div className="h-10 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            </div>
            <div className="h-px bg-border" />
          </div>
        ))}
      </div>
    </div>
  );
}
