import { Monitor } from "lucide-react";

export default function MobileBlocker() {
  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center z-[99999] md:hidden">
      <div className="text-center px-6">
        <div className="flex justify-center mb-6">
          <Monitor className="w-24 h-24 text-teal-500" strokeWidth={1.5} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          Desktop Only
        </h1>
        <p className="text-lg text-teal-600 mb-2">
          This website is configured for desktop use only
        </p>
        <p className="text-sm text-gray-600">
          Please access this application from a desktop or laptop computer
        </p>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @media (min-width: 768px) {
            .md\\:hidden {
              display: none !important;
            }
          }
        `
      }} />
    </div>
  );
}

