// frontend/src/features/projects/ProjectListPage.jsx
import React, { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useEntityList, useDeleteEntity } from "../../hooks/useCrudQueries"; // Import generic hooks
import { getProjects, deleteProject } from "../../services/projectService"; // Import specific service functions
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { debounce } from "lodash";

// --- Reusable Project Table Component --- (Move to ui if used elsewhere)
const ProjectTable = ({ projects, onDelete, isLoadingDelete }) => {
  if (!projects || projects.length === 0) {
    return (
      <p className="text-center text-gray-500 dark:text-gray-400 py-10">
        No projects found.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">
              Client Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
              Status
            </th>
            <th className="relative px-6 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {projects.map((project) => (
            <tr
              key={project._id}
              className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <Link
                  to={`/projects/${project._id}/edit`}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  {project.name}
                </Link>
              </td>
              {/* TODO: Fetch and display Client Name instead of ID */}
              <td
                className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell truncate"
                title={project.client_name}
              >
                {project.client_name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell capitalize">
                {project.status}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                <Link
                  to={`/projects/${project._id}/edit`}
                  title="Edit"
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                >
                  <PencilIcon className="h-5 w-5 inline" />
                </Link>
                <button
                  onClick={() => onDelete(project.id, project.name)}
                  title="Delete"
                  disabled={isLoadingDelete}
                  className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 disabled:opacity-50"
                >
                  <TrashIcon className="h-5 w-5 inline" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

function ProjectListPage() {
  const [searchTerm, setSearchTerm] = useState("");
  // TODO: Add state/UI for client filtering if needed

  const debouncedSetSearchTerm = useMemo(
    () => debounce((term) => setSearchTerm(term), 300),
    [],
  );
  const handleSearchChange = (event) =>
    debouncedSetSearchTerm(event.target.value);

  // --- Use generic hook for fetching ---
  const listOptions = useMemo(() => ({ searchTerm }), [searchTerm]); // Pass options to hook
  const {
    data: projects,
    isLoading,
    isError,
    error,
  } = useEntityList(
    "projects", // Base query key
    (opts) => getProjects(opts), // Fetch function wrapped to accept options object
    listOptions, // Pass options as the 3rd argument to useQuery
  );

  // --- Use generic hook for deleting ---
  const { mutate: deleteProjectMutate, isLoading: isLoadingDelete } =
    useDeleteEntity(
      "projects", // Base query key (used for invalidation)
      deleteProject, // Specific delete function
      {
        // Options for the mutation hook itself
        onSuccess: () => alert("Project deleted!"), // Replace with better notification
        onError: (err) => alert(`Failed to delete project: ${err.message}`),
      },
    );

  const handleDelete = useCallback(
    (projectId, projectName) => {
      if (
        window.confirm(
          `Delete project "${projectName}"? This cannot be undone.`,
        )
      ) {
        deleteProjectMutate(projectId); // Pass only the ID to mutate
      }
    },
    [deleteProjectMutate],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">
          Projects
        </h1>
        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          </div>
          <input
            type="search"
            placeholder="Search projects..."
            onChange={handleSearchChange}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
        <Link to="/projects/new" className="w-full sm:w-auto inline-flex ...">
          {" "}
          {/* Add New Project Link */}
          <PlusIcon className="h-5 w-5 mr-2" /> Add New Project
        </Link>
      </div>

      {/* Loading/Error State */}
      {isLoading && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-4">
          Loading projects...
        </p>
      )}
      {isError && (
        <div className="text-center text-red-600 ...">
          Error: {error?.message || "Failed to load projects"}
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && (
        <ProjectTable
          projects={projects}
          onDelete={handleDelete}
          isLoadingDelete={isLoadingDelete}
        />
      )}
      {/* TODO: Pagination */}
    </div>
  );
}
export default ProjectListPage;
