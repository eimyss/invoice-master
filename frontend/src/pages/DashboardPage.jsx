import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  ClockIcon,
  CurrencyEuroIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  BriefcaseIcon, // For projects/clients worked on
  DocumentCheckIcon, // For invoices created
} from "@heroicons/react/24/outline";
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
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css"; // Import default react-calendar styles
import "../calendar-dark.css"; // Import your custom dark theme overrides

// --- Mock Data ---
const currentMonthStats = {
  hours: 145,
  revenue: 7250.5,
};

const previousMonthStats = {
  hours: 130,
  revenue: 6800.0,
};

const chartData = [
  { name: "Jan", hours: 110 },
  { name: "Feb", hours: 135 },
  { name: "Mar", hours: currentMonthStats.hours }, // Use current month's data
];

// Mock calendar events (use Date objects)
const calendarEvents = [
  { date: new Date(2024, 2, 5), type: "invoice", title: "Inv #2024-003" }, // March 5th (month is 0-indexed)
  { date: new Date(2024, 2, 8), type: "work", title: "Project Alpha" }, // March 8th
  { date: new Date(2024, 2, 15), type: "work", title: "Project Beta" }, // March 15th
  { date: new Date(2024, 2, 16), type: "work", title: "Project Beta" }, // March 16th
  { date: new Date(2024, 2, 20), type: "invoice", title: "Inv #2024-004" }, // March 20th
];
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

// Helper component for Stat Cards
const StatCard = ({ title, value, icon: Icon, changeData }) => (
  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
    <div className="flex items-center justify-between mb-3">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {title}
      </p>
      <Icon className="h-6 w-6 text-gray-400 dark:text-gray-500" />
    </div>
    <p className="text-3xl font-semibold text-gray-900 dark:text-white mb-1">
      {value}
    </p>
    {changeData && changeData.value !== null && (
      <div
        className={`flex items-center text-sm ${changeData.type === "increase" ? "text-green-500" : "text-red-500"}`}
      >
        {changeData.type === "increase" ? (
          <ArrowUpIcon className="h-4 w-4 mr-1" />
        ) : (
          <ArrowDownIcon className="h-4 w-4 mr-1" />
        )}
        {changeData.value}%{" "}
        {changeData.type === "increase" ? "Increase" : "Decrease"} vs last month
      </div>
    )}
    {!changeData && <div className="h-5"></div>}{" "}
    {/* Placeholder for alignment */}
  </div>
);

const DashboardPage = () => {
  const { user } = useAuth(); // Get user info if needed
  const [calendarDate, setCalendarDate] = useState(new Date()); // State for calendar

  const hoursChange = calculateChange(
    currentMonthStats.hours,
    previousMonthStats.hours,
  );
  const revenueChange = calculateChange(
    currentMonthStats.revenue,
    previousMonthStats.revenue,
  );

  // Function to add markers to calendar tiles
  const tileContent = ({ date, view }) => {
    if (view === "month") {
      const event = calendarEvents.find(
        (e) =>
          e.date.getDate() === date.getDate() &&
          e.date.getMonth() === date.getMonth() &&
          e.date.getFullYear() === date.getFullYear(),
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
      const event = calendarEvents.find(
        (e) =>
          e.date.getDate() === date.getDate() &&
          e.date.getMonth() === date.getMonth() &&
          e.date.getFullYear() === date.getFullYear(),
      );
      if (event) {
        return event.type === "invoice" ? "has-event has-invoice" : "has-event";
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
        Welcome back, {user?.name || user?.email || "User"}! Here's your
        overview.
      </p>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Hours This Month"
          value={currentMonthStats.hours}
          icon={ClockIcon}
          changeData={hoursChange}
        />
        <StatCard
          title="Revenue This Month"
          value={`€ ${currentMonthStats.revenue.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={CurrencyEuroIcon}
          changeData={revenueChange}
        />
        {/* Add more cards as needed */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400">Placeholder Card 1</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400">Placeholder Card 2</p>
        </div>
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
            // locale="de-DE" // Optional: Set locale if needed
          />
          {/* Optional: Display selected date or events for the date */}
          {/* <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">Selected: {calendarDate.toLocaleDateString('de-DE')}</p> */}
        </div>
      </div>

      {/* Add other sections like Recent Invoices, Active Projects table etc. */}
    </div>
  );
};

export default DashboardPage;
