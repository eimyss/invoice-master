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

const StatCardWidget = ({
  value,
  isLoading,
  isError,
  error,
  title,
  Icon,
  changeData,
}) => {
  console.log("HoursSummaryWidget RENDERED. Props:", {
    isLoading,
    value,
    title,
    Icon,
    changeData,
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

  if (!value) {
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

  return (
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
          {changeData.type === "increase" ? "Increase" : "Decrease"} vs last
          month
        </div>
      )}
      {!changeData && <div className="h-5"></div>}{" "}
      {/* Placeholder for alignment */}
    </div>
  );
};
StatCardWidget.propTypes = {
  isLoading: PropTypes.bool,
  isError: PropTypes.bool,
  value: PropTypes.string,
  error: PropTypes.object, // Or PropTypes.instanceOf(Error)
  changeData: PropTypes.func,
};
// PropTypes if needed, though less common for internal feature components without TS
// HoursSummaryWidget.propTypes = {};

export default StatCardWidget;
