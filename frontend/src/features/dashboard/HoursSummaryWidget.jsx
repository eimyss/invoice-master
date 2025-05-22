// frontend/src/features/dashboard/HoursSummaryWidget.jsx
import React from "react";
import PropTypes from "prop-types";
import { useQuery } from "@tanstack/react-query";
import { getHoursSummary } from "../../services/dashboardService";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

// Helper to format date for XAxis
const formatXAxisDate = (dateString) => {
  try {
    // Assuming dateString is "YYYY-MM-DD" from backend DailyHours.day
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }); // e.g., "May 08"
  } catch (e) {
    console.error("Error", e);
    return dateString;
  }
};

const HoursSummaryWidget = ({ summary, isLoading, isError, error }) => {
  console.log("HoursSummaryWidget RENDERED. Props:", {
    summary,
    isLoading,
    isError,
    error,
  });
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md animate-pulse">
        <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
        <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded w-1/2 mb-3"></div>
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
        <div className="mt-4 h-32 bg-gray-300 dark:bg-gray-700 rounded"></div>{" "}
        {/* Chart placeholder */}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">
          Hours Summary
        </h3>
        <p className="mt-2 text-red-500">
          Error loading data: {error?.message || "Unknown error"}
        </p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">
          Hours Summary
        </h3>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          No summary data available.
        </p>
      </div>
    );
  }

  const currentHours = summary.current_month_total_hours || 0;
  const previousHours = summary.previous_month_total_hours || 0;
  let changePercent = 0;
  let changeType = "neutral";

  if (previousHours > 0) {
    changePercent = ((currentHours - previousHours) / previousHours) * 100;
    changeType = changePercent >= 0 ? "increase" : "decrease";
  } else if (currentHours > 0) {
    changeType = "increase"; // Increase from zero
    changePercent = 100; // Or handle as "new activity"
  }

  // Prepare data for the daily chart
  // Assuming daily_hours_current_month is an array of { day: "YYYY-MM-DD", hours: X }
  const chartData = summary.daily_hours_current_month.map((item) => ({
    name: formatXAxisDate(item.day), // Format for display
    hours: item.hours,
  }));

  return (
    <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-md col-span-1 md:col-span-2">
      {" "}
      {/* Allow widget to span more columns */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Hours Logged This Month
        </h3>
        <ClockIcon className="h-6 w-6 text-gray-400 dark:text-gray-500" />
      </div>
      <p className="text-3xl font-semibold text-gray-900 dark:text-white mb-1">
        {currentHours.toFixed(1)} hrs
      </p>
      {previousHours > 0 || currentHours > 0 ? ( // Show change if there's any activity
        <div
          className={`flex items-center text-xs ${
            changeType === "increase"
              ? "text-green-500 dark:text-green-400"
              : changeType === "decrease"
                ? "text-red-500 dark:text-red-400"
                : "text-gray-500 dark:text-gray-400"
          }`}
        >
          {changeType === "increase" && (
            <ArrowUpIcon className="h-4 w-4 mr-1" />
          )}
          {changeType === "decrease" && (
            <ArrowDownIcon className="h-4 w-4 mr-1" />
          )}
          {changePercent !== 0 &&
            `${changeType !== "neutral" ? Math.abs(changePercent).toFixed(0) + "%" : ""} ${changeType === "increase" ? "more" : "less"}`}
          {previousHours > 0 &&
            ` than last month (${previousHours.toFixed(1)} hrs)`}
          {previousHours === 0 && currentHours > 0 && " (New activity)"}
        </div>
      ) : (
        <div className="h-5 text-xs text-gray-500 dark:text-gray-400">
          No activity last month.
        </div> // Placeholder for alignment
      )}
      {/* Daily Hours Chart */}
      {chartData.length > 0 && (
        <div className="mt-6 h-48 md:h-56">
          {" "}
          {/* Adjust height as needed */}
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 0, left: -25, bottom: 5 }}
            >
              {" "}
              {/* Adjust left margin for YAxis labels */}
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#4B556320"
                dark:stroke="#4B556350"
              />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#9CA3AF" />
              <YAxis
                tick={{ fontSize: 10 }}
                stroke="#9CA3AF"
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(31, 41, 55, 0.9)",
                  border: "1px solid #4B5563",
                  borderRadius: "0.375rem",
                }} // Tailwind bg-gray-800 dark
                labelStyle={{ color: "#F3F4F6", fontWeight: "bold" }} // Tailwind text-gray-100
                itemStyle={{ color: "#D1D5DB" }} // Tailwind text-gray-300
                formatter={(value) => [`${value.toFixed(1)} hrs`, "Hours"]}
              />
              {/* <Legend wrapperStyle={{ fontSize: '12px' }} /> */}
              <Bar
                dataKey="hours"
                fill="#3B82F6"
                barSize={10}
                radius={[4, 4, 0, 0]}
              />{" "}
              {/* Tailwind blue-500 */}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {chartData.length === 0 && !isLoading && (
        <p className="mt-6 text-sm text-center text-gray-400 dark:text-gray-500">
          No daily data for this month yet.
        </p>
      )}
    </div>
  );
};

// PropTypes if needed, though less common for internal feature components without TS
// HoursSummaryWidget.propTypes = {};

export default HoursSummaryWidget;
