// frontend/src/features/events/EventListPage.jsx

import React, { useState, useCallback } from "react";
import { Link } from "react-router-dom"; // For linking to detail page later
import { Modal } from "../../components/ui/Modal"; // Your general Modal component
import { useEntityList } from "../../hooks/useCrudQueries"; // Generic hook
import { getEventById, getEvents } from "../../services/eventService";
import { EyeIcon } from "@heroicons/react/24/outline";
import { EventViewer } from "../../components/ui/EventViewer";
// Helper to format date strings
const formatDate = (dateString) => {
  if (!dateString) return "-";
  try {
    // Assuming backend sends ISO date string (YYYY-MM-DD)
    return new Date(dateString).toLocaleDateString("de-DE", {
      // German locale
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch (e) {
    return dateString; // Fallback
  }
};
const EventTable = ({ events, onViewEvent }) => {
  if (!events || events.length === 0) {
    return (
      <p className="text-center text-gray-500 dark:text-gray-400 py-10">
        No events found.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Number
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">
              Description
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
              Relavant Date
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Entity ID
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Entity Type
            </th>
            <th className="relative px-6 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {events.map((event) => (
            <tr
              key={event._id}
              className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                {/* TODO: Link to event detail page */}
                <Link to={`/events/${event._id}`}>{event.event_number}</Link>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                {event.event_type || "N/A"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                {event.description}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                {formatDate(event.relevant_date)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-right">
                {event.related_entity_id}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                {/* TODO: Add badge styling for status */}
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 capitalize">
                  {event.related_entity_type}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                {/* TODO: Link to Detail View */}
                {/* <Link to={`/events/${event.id}`} title="View Details" className="p-1 text-gray-400 hover:text-blue-600"><EyeIcon className="h-5 w-5 inline"/></Link> */}
                <button
                  onClick={() => onViewEvent(event._id, event.event_number)} // Call onViewPdf
                  title="View Event"
                  className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <EyeIcon className="h-5 w-5 inline" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

function EventListPage() {
  const [filters, setFilters] = useState({}); // State for filters later
  const [eventFileName, setEventFileName] = useState("");
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isLoadingEvent, setIsLoadingEvent] = useState(false);
  const [singleEvent, setSingleEvent] = useState(null);
  // --- Fetch Events ---
  const {
    data: events,
    isLoading,
    isError,
    error,
  } = useEntityList(
    "events", // Query Key Base
    ({ filters }) => getEvents({ queryKey: ["events", { filters }] }), // Pass filters from options
    { filters }, // Options object passed to useQuery
  );

  const handleViewEvent = useCallback(async (eventId, eventNumber) => {
    if (!eventId) {
      console.log("no Event ID provided");
      return;
    }
    console.log("Viewing PDF for event:", eventId);
    setIsLoadingEvent(true);
    setIsEventModalOpen(true); // Open modal immediately to show loading state
    setEventFileName(
      `Rechnung_${eventNumber}_${new Date().toISOString().split("T")[0]}.pdf`,
    );

    try {
      const event = await getEventById(eventId);
      setSingleEvent(event);
    } catch (error) {
      console.error("Error fetching event:", error);
      alert(`Failed to load event: ${error.message || "Unknown error"}`);
      setIsEventModalOpen(false); // Close modal on error
    } finally {
      setIsLoadingEvent(false);
    }
  }, []);

  const closeEventModal = () => {
    setIsEventModalOpen(false);
    setSingleEvent(null); // Clean up blob state
  };
  // --- Mutation for Preparing Email ---

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">
          Events
        </h1>
        {/* TODO: Add Filters (Status Dropdown, Client Picker, Date Range) */}
        {/* <div className="flex gap-4"> ... Filters ... </div> */}
      </div>

      {/* Loading and Error States */}
      {isLoading && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-4">
          Loading events...
        </p>
      )}
      {isError && (
        <div className="text-center text-red-600 ...">
          Error: {error?.message || "Failed to load events"}
        </div>
      )}

      {/* Event Table */}
      {!isLoading && !isError && (
        <EventTable
          events={events}
          onViewEvent={handleViewEvent} // Pass new handler
        />
      )}

      {/* Pagination TODO */}

      {/* Email Preview Modal */}
      <Modal
        isOpen={isEventModalOpen}
        onClose={closeEventModal}
        title={`Viewing Event: ${eventFileName}`}
        size="4xl" // Use a larger size for PDFs
      >
        {isLoadingEvent && (
          <div className="p-10 text-center">Loading Event...</div>
        )}
        {!isLoadingEvent && singleEvent && (
          <div className="h-[80vh] w-full">
            {" "}
            {/* Set height for the viewer */}
            <EventViewer event={singleEvent} />
          </div>
        )}
        {!isLoadingEvent && !singleEvent && !isEventModalOpen && (
          /* Only if error occurred and modal closed */ <div className="p-10 text-center text-red-500">
            Failed to load Event.
          </div>
        )}
      </Modal>
    </div>
  );
}

export default EventListPage;
