// frontend/src/components/ui/PdfViewer.jsx
import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";

export const EventViewer = ({ event, fileName = "invoice.pdf" }) => {
  const [eventUrl, setEventUrl] = useState("");

  useEffect(() => {
    if (event) {
      setEventUrl("URL");

      // Clean up the object URL when the component unmounts or blob changes
      return () => {
        setEventUrl(""); // Clear URL
      };
    } else {
      setEventUrl(""); // Clear if blob is not valid
    }
  }, [event]); // Re-run effect if the blob prop changes

  if (!eventUrl) {
    return (
      <p className="p-4 text-center text-gray-500 dark:text-gray-400">
        No Event to display or Event is loading.
      </p>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Using <object> is often more reliable for embedding PDFs */}
      <p className="p-4 text-center">
        {/* Provide a direct download link as a fallback */}
        <a download={fileName} className="text-blue-600 hover:underline ml-1">
          Download the PDF
        </a>
        instead.
      </p>
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
