// frontend/src/components/ui/PdfViewer.jsx
import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";

export const PdfViewer = ({ blob, fileName = "invoice.pdf", onDownload }) => {
  const [pdfUrl, setPdfUrl] = useState("");

  useEffect(() => {
    if (blob instanceof Blob) {
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      console.log("PdfViewer: Created object URL:", url);

      // Clean up the object URL when the component unmounts or blob changes
      return () => {
        console.log("PdfViewer: Revoking object URL:", url);
        URL.revokeObjectURL(url);
        setPdfUrl(""); // Clear URL
      };
    } else {
      setPdfUrl(""); // Clear if blob is not valid
    }
  }, [blob]); // Re-run effect if the blob prop changes

  if (!pdfUrl) {
    return (
      <p className="p-4 text-center text-gray-500 dark:text-gray-400">
        No PDF to display or PDF is loading.
      </p>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {onDownload && ( // Optionally show a download button
        <div className="p-2 bg-gray-100 dark:bg-gray-700 text-right">
          <a
            href={pdfUrl}
            download={fileName}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Download PDF
          </a>
        </div>
      )}
      {/* Using <object> is often more reliable for embedding PDFs */}
      <object data={pdfUrl} type="application/pdf" width="100%" height="100%">
        <p className="p-4 text-center">
          Your browser does not support embedded PDFs.
          {/* Provide a direct download link as a fallback */}
          <a
            href={pdfUrl}
            download={fileName}
            className="text-blue-600 hover:underline ml-1"
          >
            Download the PDF
          </a>
          instead.
        </p>
      </object>
      {/* Alternatively, using an iframe:
            <iframe
                src={pdfUrl}
                title={fileName}
                width="100%"
                height="100%"
                style={{ border: 'none' }}
            />
            */}
    </div>
  );
};

PdfViewer.propTypes = {
  blob: PropTypes.instanceOf(Blob), // Expect a Blob object
  fileName: PropTypes.string,
  onDownload: PropTypes.func, // Optional callback if a download button is needed
};
