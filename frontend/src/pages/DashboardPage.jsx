import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { ClockIcon, CurrencyEuroIcon } from "@heroicons/react/24/outline";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getHoursSummary } from "../services/dashboardService";
import { useQuery } from "@tanstack/react-query";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css"; // Import default react-calendar styles
import "../calendar-dark.css"; // Import your custom dark theme overrides
import HoursSummaryWidget from "../features/dashboard/HoursSummaryWidget";
import StatCardWidget from "../features/dashboard/StatCardWidget";
// --- Mock Data ---

// Mock calendar events (use Date objects)
// --- End Mock Data ---

// Helper function to calculate percentage change
const calculateChange = (current, previous) => {
  if (previous === 0) return { value: null, type: "neutral" }; // Avoid division by zero
  const change = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(change).toFixed(1),
    type: change >= 0 ? "increase" : "decrease",
  };
};
const getMonthName = (date, locale = "en-US", monthFormat = "short") => {
  if (!(date instanceof Date) || isNaN(date)) {
    return ""; // Return empty string for invalid dates
  }
  return date.toLocaleString(locale, { month: monthFormat });
};
const DashboardPage = () => {
  const {
    data: summary,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["dashboardHoursSummary"], // Unique key for this query
    queryFn: getHoursSummary,
    staleTime: 1000 * 60 * 15, // Cache for 15 minutes
    // refetchOnWindowFocus: false, // Optional: disable refetch on window focus if data isn't too volatile
  });
  const dateThisMonth = new Date();
  var dateLastMonth = new Date();
  dateLastMonth.setMonth(dateThisMonth.getMonth() - 1);
  var dateMoreLastMonth = new Date();
  dateMoreLastMonth.setMonth(dateThisMonth.getMonth() - 2);

  const chartData = [
    {
      name: getMonthName(dateMoreLastMonth),
      hours: summary?.previous_month_total_hours,
    },
    {
      name: getMonthName(dateLastMonth),
      hours: summary?.previous_month_total_hours,
    },
    {
      name: getMonthName(dateThisMonth),
      hours: summary?.current_month_total_hours,
    }, // Use current month's data
  ];

  const calendarEvents = summary?.active_work_dates_current_month || []; // Mock data for calendar events
  const { userInfo } = useAuth(); // Get user info if needed
  const [calendarDate, setCalendarDate] = useState(new Date()); // State for calendar

  const displayUsername = userInfo
    ? userInfo.name || userInfo.email || "User"
    : "Loading User...";
  console.log("Layout: Displaying username as:", displayUsername);
  const hoursChange = calculateChange(
    summary?.current_month_total_hours || 0,
    summary?.previous_month_total_hours || 0,
  );
  const revenueChange = calculateChange(
    summary?.current_month_total_revenue || 0,
    summary?.previous_month_total_revenue || 0,
  );

  // Function to add markers to calendar tiles
  const tileContent = ({ date, view }) => {
    if (view === "month") {
      const event = calendarEvents.find(
        (dateString) => dateString === date.toISOString().slice(0, 10),
      );
      // Return null or a marker element
      return event ? (
        <span className="event-marker" title={event.title}></span>
      ) : null;
    }
    return null;
  };

  // Function to add class names for styling event markers
  const tileClassName = ({ date, view }) => {
    if (view === "month") {
      if (calendarEvents.length > 0) {
        const event = calendarEvents.find(
          (dateString) => dateString === date.toISOString().slice(0, 10),
        );
        if (event) {
          return event.type === "invoice"
            ? "has-event has-invoice"
            : "has-event";
        }
      }
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">
        Dashboard
      </h1>
      <p className="text-gray-600 dark:text-gray-400">
        Welcome back {displayUsername}! Here's your overview. overview.
      </p>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCardWidget
          title="Hours This Month"
          value={summary?.current_month_total_hours || 0}
          Icon={ClockIcon}
          changeData={hoursChange}
          isLoading={isLoading}
          isError={isError}
          error={error}
        />
        <StatCardWidget
          title="Revenue This Month"
          value={`€ ${summary?.current_month_total_revenue.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          Icon={CurrencyEuroIcon}
          changeData={revenueChange}
          isLoading={isLoading}
          isError={isError}
          error={error}
        />
        {/* Add more cards as needed */}
        <HoursSummaryWidget
          summary={summary}
          isLoading={isLoading}
          isError={isError}
          error={error}
        />
      </div>

      {/* Chart and Calendar Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hours Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">
            Hours Logged (Last 3 Months)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 20, left: -10, bottom: 5 }} // Adjust margins
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />{" "}
              {/* Darker grid for dark theme */}
              <XAxis dataKey="name" stroke="#9CA3AF" /> {/* Axis color */}
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1F2937",
                  border: "1px solid #374151",
                }} // Dark tooltip
                itemStyle={{ color: "#E5E7EB" }}
              />
              <Legend wrapperStyle={{ color: "#E5E7EB" }} />
              <Line
                type="monotone"
                dataKey="hours"
                stroke="#3B82F6"
                strokeWidth={2}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Calendar Widget */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-3 text-center">
            Activity Calendar
          </h2>
          <Calendar
            onChange={setCalendarDate}
            value={calendarDate}
            className="!border-0 !w-full !bg-transparent" // Use ! to force override defaults if needed
            tileContent={tileContent} // Add markers/content
            tileClassName={tileClassName} // Add classes for styling markers
            //onClickDay={}
            // locale="de-DE" // Optional: Set locale if needed
          />
          {/* Optional: Display selected date or events for the date */}
          <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
            Selected: {calendarDate.toLocaleDateString("de-DE")}
          </p>
        </div>
      </div>

      {/* Add other sections like Recent Invoices, Active Projects table etc. */}
    </div>
  );
};

export default DashboardPage;
