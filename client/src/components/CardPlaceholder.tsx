import { Card, CardContent } from '@/components/ui/card';

interface CardPlaceholderProps {
  count?: number;
  className?: string;
}

export const CardPlaceholder = ({ count = 3, className = "" }: CardPlaceholderProps) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <Card 
          key={index}
          className={`flex-shrink-0 w-72 h-[480px] shadow-sm border-gray-200 dark:border-gray-700 ${className}`}
        >
          <CardContent className="p-8 h-full flex flex-col justify-between">
            {/* Icon Section Placeholder */}
            <div className="bg-gray-100 dark:bg-custom-dark-2 rounded-lg p-6 mb-6 flex items-center justify-center animate-pulse">
              <div className="w-16 h-16 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
            </div>
            
            {/* Content Section Placeholder */}
            <div className="flex-1">
              {/* Title placeholder */}
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4 w-3/4 animate-pulse"></div>
              
              {/* Description placeholder */}
              <div className="space-y-2 mb-4">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6 animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/6 animate-pulse" style={{ animationDelay: '0.3s' }}></div>
              </div>
            </div>
            
            {/* Button Section Placeholder */}
            <div className="mt-auto">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
};

export default CardPlaceholder;