// frontend/src/components/ui/PrepareEmailModal.jsx
import React from "react";
import PropTypes from "prop-types";
import { Modal } from "./Modal"; // Your reusable Modal
import {
  DocumentDuplicateIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";

export const PrepareEmailModal = ({
  isOpen,
  onClose,
  emailContent,
  isLoading,
}) => {
  const handleCopyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(
      () => {
        alert("Copied to clipboard!"); // Replace with toast/snackbar
      },
      (err) => {
        console.error("Failed to copy text: ", err);
        alert("Failed to copy text.");
      },
    );
  };

  const handleOpenMailClient = () => {
    if (!emailContent) return;
    const subject = encodeURIComponent(emailContent.subject || "");
    const body = encodeURIComponent(emailContent.body || "");
    window.location.href = `mailto:${emailContent.recipient || ""}?subject=${subject}&body=${body}`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Prepare Invoice Email"
      size="2xl"
    >
      {isLoading && (
        <p className="text-center p-4">Generating email content...</p>
      )}
      {!isLoading && !emailContent && (
        <p className="text-center p-4">Could not load email content.</p>
      )}
      {!isLoading && emailContent && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Recipient:
            </label>
            <p className="text-sm text-gray-800 dark:text-gray-200">
              {emailContent.recipient || "(Not specified)"}
            </p>
          </div>
          <div>
            <label
              htmlFor="email-subject"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Subject:
            </label>
            <div className="relative">
              <input
                id="email-subject"
                type="text"
                readOnly
                value={emailContent.subject || ""}
                className="block w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:text-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 cursor-text"
              />
              <button
                type="button"
                onClick={() =>
                  handleCopyToClipboard(emailContent.subject || "")
                }
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Copy subject"
              >
                <DocumentDuplicateIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div>
            <label
              htmlFor="email-body"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Body:
            </label>
            <div className="relative">
              <textarea
                id="email-body"
                readOnly
                rows={10}
                value={emailContent.body || ""}
                className="block w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:text-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-xs" // Use mono font for better formatting view
              />
              <button
                type="button"
                onClick={() => handleCopyToClipboard(emailContent.body || "")}
                className="absolute top-2 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Copy body"
              >
                <DocumentDuplicateIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
            <button
              type="button"
              onClick={handleOpenMailClient}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <EnvelopeIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
              Open Mail Client
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

PrepareEmailModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  emailContent: PropTypes.shape({
    subject: PropTypes.string,
    body: PropTypes.string,
    recipient: PropTypes.string,
  }),
  isLoading: PropTypes.bool,
};
