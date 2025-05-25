// frontend/src/components/ui/EventViewer.jsx
import React from "react";
import PropTypes from "prop-types";
import { Link, useNavigate } from "react-router-dom"; // For navigation
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline"; // For external-like link

// Helper to format date and time
const formatFullDateTime = (isoString) => {
  if (!isoString) return "N/A";
  try {
    return new Date(isoString).toLocaleString("de-DE", {
      // German locale example
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch (e) {
    return isoString;
  }
};

const formatDateOnly = (isoString) => {
  if (!isoString) return "N/A";
  try {
    return new Date(isoString).toLocaleDateString("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch (e) {
    return isoString;
  }
};

export const EventViewer = ({ event }) => {
  const navigate = useNavigate();

  if (!event) {
    return (
      <p className="text-center text-gray-500 dark:text-gray-400 p-6">
        No event data to display.
      </p>
    );
  }

  const getEntityDetailPath = (type, id) => {
    if (!type || !id) return null;
    switch (type.toLowerCase()) {
      case "client":
        return `/clients/${id}`; // Or /clients/${id}/edit if that's your detail view
      case "project":
        return `/projects/${id}`;
      case "invoice":
        return `/invoices/${id}`;
      case "workitem": // Match the string you store in related_entity_type
      case "work item":
        return `/workItems/${id}`;
      // Add more cases for other entity types
      default:
        console.warn("Unknown entity type for navigation:", type);
        return null;
    }
  };

  const entityDetailPath = getEntityDetailPath(
    event.related_entity_type,
    event.related_entity_id,
  );

  const renderDetailValue = (value) => {
    if (typeof value === "object" && value !== null) {
      return (
        <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-x-auto">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }
    return String(value ?? "N/A"); // Handle null/undefined gracefully
  };

  return (
    <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
      <div className="grid grid-cols-3 gap-x-4 gap-y-2 p-4 border-b dark:border-gray-700">
        <strong className="col-span-1">Event Type:</strong>
        <span className="col-span-2 capitalize">
          {event.event_type?.replace(/_/g, " ") || "N/A"}
        </span>

        <strong className="col-span-1">Logged At:</strong>
        <span className="col-span-2">
          {formatFullDateTime(event.timestamp)}
        </span>

        <strong className="col-span-1">Relevant Date:</strong>
        <span className="col-span-2">
          {formatDateOnly(event.relevant_date)}
        </span>

        <strong className="col-span-1">User ID:</strong>
        <span className="col-span-2 truncate" title={event.user_id}>
          {event.user_id || "N/A"}
        </span>
      </div>

      {event.description && (
        <div className="p-4 border-b dark:border-gray-700">
          <strong className="block mb-1">Description:</strong>
          <p className="whitespace-pre-wrap">{event.description}</p>
        </div>
      )}

      {(event.related_entity_id || event.related_entity_type) && (
        <div className="p-4 border-b dark:border-gray-700">
          <strong className="block mb-1">Related Entity:</strong>
          <div className="grid grid-cols-3 gap-x-4 gap-y-1">
            <span className="col-span-1 text-gray-500 dark:text-gray-400">
              Type:
            </span>
            <span className="col-span-2">
              {event.related_entity_type || "N/A"}
            </span>

            <span className="col-span-1 text-gray-500 dark:text-gray-400">
              ID:
            </span>
            <span className="col-span-2">
              {entityDetailPath ? (
                <Link
                  to={entityDetailPath}
                  className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center group"
                  title={`View details for ${event.related_entity_type || "entity"}`}
                >
                  <span className="truncate" title={event.related_entity_id}>
                    {event.related_entity_id}
                  </span>
                  <ArrowTopRightOnSquareIcon className="ml-1 h-3 w-3 opacity-70 group-hover:opacity-100 transition-opacity" />
                </Link>
              ) : (
                <span className="truncate" title={event.related_entity_id}>
                  {event.related_entity_id || "N/A"}
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      {event.details && Object.keys(event.details).length > 0 && (
        <div className="p-4">
          <strong className="block mb-2">Additional Details:</strong>
          <div className="space-y-1 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">
            {Object.entries(event.details).map(([key, value]) => (
              <div key={key} className="grid grid-cols-3 gap-x-4">
                <span className="col-span-1 font-medium capitalize text-gray-600 dark:text-gray-400">
                  {key.replace(/_/g, " ")}:
                </span>
                <div className="col-span-2">{renderDetailValue(value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

EventViewer.propTypes = {
  event: PropTypes.shape({
    event_type: PropTypes.string,
    user_id: PropTypes.string,
    relevant_date: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.instanceOf(Date),
    ]),
    timestamp: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.instanceOf(Date),
    ]),
    description: PropTypes.string,
    related_entity_id: PropTypes.string, // Assuming UUIDs are strings after JSON parse
    related_entity_type: PropTypes.string,
    details: PropTypes.object,
  }), // Can be null if loading or error
};
