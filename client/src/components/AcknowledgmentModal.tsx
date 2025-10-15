import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from "@sparrowengg/twigs-react";
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AcknowledgmentPDF {
  data: string; // base64 encoded PDF data
  filename: string;
  content_type: string;
}

interface AcknowledgmentModalProps {
  isOpen: boolean;
  acknowledgmentPdf: AcknowledgmentPDF | null;
  onProceed: () => void;
  onClose?: () => void;
}

export const AcknowledgmentModal: React.FC<AcknowledgmentModalProps> = ({
  isOpen,
  acknowledgmentPdf,
  onProceed,
  onClose
}) => {
  const [acknowledgmentText, setAcknowledgmentText] = useState('');
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string>('');

  const handleAcknowledgmentChange = (value: string) => {
    setAcknowledgmentText(value);
    setIsAcknowledged(value.toLowerCase() === 'acknowledged');
  };

  const handleProceed = () => {
    if (isAcknowledged) {
      onProceed();
    }
  };

  // Sparrow logo component
  const SparrowLogo = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0.19154398143291473 -0.0020752372220158577 92.23655700683594 101.78607177734375" className="w-5 h-5">
      <g id="bird" fill="currentColor">
        <path d="M77.8832 26.026C78.3666 19.2146 74.3957 12.8791 68.09 10.4029C61.7842 7.91926 54.6085 9.8675 50.3848 15.1991L47.3583 14.1507L44.2724 13.184L41.1492 12.3065C45.4175 4.96715 53.1138 0.334499 61.5463 0.0147496C69.9787 -0.297564 78.0097 3.75508 82.8059 10.7598L92.4281 11.4365L77.8832 26.026Z"></path>
        <path d="M84.9772 51.9928L84.9103 54.0972L84.7616 56.2016L84.5236 58.2837L84.1964 60.3435L83.78 62.4032L83.2818 64.4407L82.6944 66.4559L82.0177 68.4487L81.2592 70.397L80.4338 72.3229L79.4969 74.1819L78.5004 76.0409L77.4371 77.8404L76.2845 79.573L75.065 81.2833L73.7637 82.9267L72.4178 84.5031L70.9826 86.035L69.4805 87.4998L67.9413 88.9053L66.3351 90.2214L64.662 91.493L62.9442 92.6753L61.1819 93.7907L59.3601 94.8169L57.5159 95.7836L55.6272 96.661L53.6938 97.4493L51.7381 98.1483L49.7602 98.7803L47.7376 99.3083L45.715 99.7693L43.6477 100.119L41.6028 100.401L39.5207 100.58L37.4387 100.691H35.3714L33.2893 100.602L31.2073 100.424L29.14 100.163L27.0951 99.8139L25.0502 99.3752L23.0499 98.8472L21.0496 98.2524L19.7929 98.9513L18.4693 99.5685L17.1457 100.141L15.7775 100.624L14.387 101.019L12.9741 101.323L11.539 101.561L10.1038 101.718L8.64633 101.784L7.18887 101.762L5.75372 101.673L4.31856 101.472L2.88341 101.212L18.0529 85.9829C33.044 94.0287 51.4779 91.2848 63.5243 79.2087C75.5632 67.1325 78.3963 48.5499 70.5067 33.3878L77.8684 26.0038L78.9169 27.8331L79.8761 29.6921L80.7684 31.5734L81.5715 33.5217L82.2854 35.4922L82.9397 37.4851L83.4826 39.5002L83.9585 41.5377L84.3303 43.6198L84.6128 45.7019L84.8285 47.784L84.94 49.8661L84.9623 51.9705L84.9772 51.9928Z"></path>
        <path fillRule="evenodd" clipRule="evenodd" d="M36.3009 82.7781C53.4038 82.7781 67.2794 68.7909 67.2794 51.5318C67.2794 50.4685 67.2274 49.4126 67.1233 48.3715C66.7887 45.003 65.9187 41.7832 64.6025 38.8162L37.7733 65.5859L21.5404 49.3531C20.0829 47.8956 20.0829 45.531 21.5404 44.0735C22.9979 42.616 25.3625 42.616 26.82 44.0735L37.7807 55.0342L60.6539 32.213C57.1293 27.6993 52.3999 24.1895 46.9568 22.1744C46.927 22.1595 46.9047 22.1521 46.875 22.1446C46.4585 21.9959 46.0347 21.8472 45.6034 21.7059C45.5737 21.6985 45.5514 21.691 45.5216 21.6836C35.3565 18.2779 24.4776 16.4337 13.1823 16.4337C9.48659 16.4337 5.84293 16.6345 2.25132 17.0212C0.912839 20.8284 0.191544 24.9183 0.191544 29.1865C0.191544 36.169 2.13235 42.683 5.50087 48.2302C5.3819 49.3159 5.32984 50.4164 5.32984 51.5318C5.32984 68.7909 19.2055 82.7781 36.3084 82.7781H36.3009Z"></path>
      </g>
    </svg>
  );

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  useEffect(() => {
    if (acknowledgmentPdf?.data) {
      // Create blob URL for PDF display
      const pdfBlob = new Blob([
        Uint8Array.from(atob(acknowledgmentPdf.data), c => c.charCodeAt(0))
      ], { type: acknowledgmentPdf.content_type });
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);

      // Cleanup function to revoke URL
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [acknowledgmentPdf]);

  if (!acknowledgmentPdf) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="overflow-visible p-0 sm:max-w-7xl w-[95vw] h-[95vh] gap-0"
      >
        {/* Custom Modal Header */}
        <div className="border-b px-6 py-4 mb-0" style={{ backgroundColor: '#44444E', borderColor: '#44444E' }}>
          <div className="flex items-center gap-3">
            <SparrowLogo />
            <div>
              <h2 className="text-lg font-semibold text-white">
                {acknowledgmentPdf.filename || 'Job Description & Requirements'}
              </h2>
              <p className="text-sm text-gray-300">1 page</p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* PDF Thumbnail Sidebar */}
          <div className="w-48 p-4" style={{ backgroundColor: '#44444E', borderRight: '1px solid #5a5a64' }}>
            <div className="space-y-2">
              <div className="border rounded-md overflow-hidden" style={{ backgroundColor: '#f8f8f8', borderColor: '#5a5a64' }}>
                <div className="aspect-[3/4] p-2 flex items-center justify-center" style={{ backgroundColor: '#f8f8f8' }}>
                  <iframe
                    src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                    className="max-w-full max-h-full pointer-events-none border-none"
                    style={{
                      width: 'calc(100% * 0.8)',
                      height: 'calc(100% * 0.8)',
                      border: 'none',
                      backgroundColor: 'white'
                    }}
                    title="PDF Thumbnail"
                  />
                </div>
              </div>
              <div className="text-center">
                <span className="text-xs font-medium text-gray-300">Page 1</span>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col" style={{ backgroundColor: '#44444E' }}>
            {/* PDF Viewer */}
            <div className="flex-1 overflow-auto" style={{ backgroundColor: 'white' }}>
              <iframe
                src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                className="w-full h-full min-h-[800px]"
                style={{ border: 'none', backgroundColor: 'white' }}
                title="PDF Document"
              />
            </div>

            {/* Acknowledgment Section */}
            <div className="p-4" style={{ backgroundColor: '#44444E', borderTop: '1px solid #5a5a64' }}>
              <div className="max-w-4xl mx-auto space-y-3">
                <p className="text-sm text-gray-300">
                  Type "acknowledged" to confirm you have read and understood the job description:
                </p>
                <div className="flex items-center gap-4">
                  <Input
                    id="acknowledgment"
                    type="text"
                    value={acknowledgmentText}
                    onChange={(e) => handleAcknowledgmentChange(e.target.value)}
                    placeholder="Type 'acknowledged' here..."
                    className="flex-1 max-w-md text-white border-gray-500"
                    style={{ backgroundColor: '#6b6b75' }}
                  />
                  <div className="ml-auto">
                    <Button
                      onClick={handleProceed}
                      disabled={!isAcknowledged}
                      className="min-w-[120px] rounded-full"
                    >
                      Proceed
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
