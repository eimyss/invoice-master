// frontend/src/hooks/useCrudQueries.js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// --- Hook for fetching a list of entities ---
export function useEntityList(queryKeyBase, fetchListFn, options = {}) {
  // queryKeyBase should be something like 'clients' or 'projects'
  // options can include search terms, pagination, etc. passed via queryKey
  const queryKey = [queryKeyBase, options];

  return useQuery({
    queryKey: queryKey,
    queryFn: () => fetchListFn(options), // Pass options to fetch function
    placeholderData: (prev) => prev, // Keep previous data while loading
    staleTime: 1000 * 60 * 2, // Example: 2 minutes stale time
    ...options, // Allow overriding default query options
  });
}

// --- Hook for fetching a single entity ---
export function useEntityDetail(
  queryKeyBase,
  fetchDetailFn,
  entityId,
  options = {},
) {
  const queryKey = [queryKeyBase, entityId];

  return useQuery({
    queryKey: queryKey,
    queryFn: () => fetchDetailFn(entityId),
    enabled: !!entityId, // Only run if entityId is provided
    staleTime: 1000 * 60 * 5, // Example: 5 minutes stale time
    ...options,
  });
}

// --- Hook for Creating an entity ---
export function useCreateEntity(queryKeyToInvalidate, createFn, options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createFn,
    onSuccess: (data, variables, context) => {
      console.log(`${queryKeyToInvalidate} created:`, data);
      // Invalidate the list query to refetch
      queryClient.invalidateQueries({ queryKey: [queryKeyToInvalidate] });
      // Optional: Call onSuccess callback provided in options
      if (options.onSuccess) options.onSuccess(data, variables, context);
    },
    onError: (error, variables, context) => {
      console.error(`Error creating ${queryKeyToInvalidate}:`, error);
      if (options.onError) options.onError(error, variables, context);
    },
    ...options, // Allow overriding default mutation options
  });
}

// --- Hook for Updating an entity ---
export function useUpdateEntity(queryKeyBase, updateFn, options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    // updateFn typically expects an object like { entityId, entityData }
    mutationFn: updateFn,
    onSuccess: (data, variables, context) => {
      console.log(`${queryKeyBase} updated:`, data);
      // Invalidate list and detail queries
      queryClient.invalidateQueries({ queryKey: [queryKeyBase] });
      // Update the specific entity's cache directly
      if (variables?.entityId) {
        // Check if entityId was passed in variables
        queryClient.setQueryData([queryKeyBase, variables.entityId], data);
      }
      if (options.onSuccess) options.onSuccess(data, variables, context);
    },
    onError: (error, variables, context) => {
      console.error(`Error updating ${queryKeyBase}:`, error);
      if (options.onError) options.onError(error, variables, context);
    },
    ...options,
  });
}

// --- Hook for Deleting an entity ---
export function useDeleteEntity(queryKeyBase, deleteFn, options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    // deleteFn typically expects the entityId
    mutationFn: deleteFn,
    onSuccess: (data, variables, context) => {
      // 'variables' here is the entityId passed to mutate
      console.log(`${queryKeyBase} deleted:`, variables);
      // Invalidate the list query
      queryClient.invalidateQueries({ queryKey: [queryKeyBase] });
      // Remove the deleted item's detail query from cache if it exists
      queryClient.removeQueries({ queryKey: [queryKeyBase, variables] });
      if (options.onSuccess) options.onSuccess(data, variables, context);
    },
    onError: (error, variables, context) => {
      console.error(`Error deleting ${queryKeyBase}:`, error);
      if (options.onError) options.onError(error, variables, context);
    },
    ...options,
  });
}
