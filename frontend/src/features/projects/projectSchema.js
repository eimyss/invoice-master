// frontend/src/features/projects/projectSchema.js
import { z } from "zod";

// Define possible project statuses (can be imported from constants file later)
const ProjectStatus = {
  ACTIVE: "active",
  ON_HOLD: "on_hold",
  COMPLETED: "completed",
  ARCHIVED: "archived",
};
const projectStatuses = Object.values(ProjectStatus); // Array of valid statuses

// Zod schema for the Rate sub-object
const rateSchema = z.object({
  name: z.string().min(1, "Rate name is required").max(100),
  price_per_hour: z
    .number({ invalid_type_error: "Price must be a number" })
    .positive({ message: "Price must be positive" })
    .max(10000, "Price seems too high"), // Optional: sanity check max
});

// Zod schema for the main Project form
export const projectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(150),
  // client_id should be a UUID string from the picker
  client_id: z
    .string()
    .uuid({ message: "Valid client must be selected" })
    .min(1, "Client is required"),
  description: z.string().max(5000).optional().nullable().or(z.literal("")),
  // Use z.enum for predefined status values
  status: z.enum(projectStatuses, {
    errorMap: () => ({ message: "Invalid status selected" }),
  }),
  // Define rates as an array of the rateSchema
  rates: z
    .array(rateSchema)
    .min(1, "At least one rate must be defined") // Require at least one rate
    .max(10, "Maximum of 10 rates allowed") // Optional: limit number of rates
    .optional(), // Make the whole array optional initially if needed, or provide default
  // Add other fields like dates if necessary
  // start_date: z.date().optional().nullable(),
  // end_date: z.date().optional().nullable(),
});

// Export Zod types if you were using TS, but not needed for JS runtime
// export type RateFormData = z.infer<typeof rateSchema>;
// export type ProjectFormData = z.infer<typeof projectSchema>;
