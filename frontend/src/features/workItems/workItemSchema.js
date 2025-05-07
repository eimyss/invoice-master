// frontend/src/features/workItems/workItemSchema.js
import { z } from "zod";

// Define possible workItem statuses (can be imported from constants file later)
const WorkItemStatus = {
  ACTIVE: "active",
  CREATED: "created",
  DISABLED: "disabled",
  CANCELED: "canceled",
  PROCESSED: "processed",
  SENT: "sent",
};
const workItemStatuses = Object.values(WorkItemStatus); // Array of valid statuses

// Zod schema for the Rate sub-object
const paymentItemSchema = z.object({
  name: z.string().min(1, "Rate name is required").max(100),
  description: z.string().min(1, "Rate name is required").max(100),
  hours: z.number(),

  rateId: z.string().min(1, "Rate Reference is required").max(100),
  calculatedAmount: z
    .number({ invalid_type_error: "Price must be a number" })
    .positive({ message: "Price must be positive" })
    .max(50000, "Price seems too high"), // Optional: sanity check max
  price_per_hour: z
    .number({ invalid_type_error: "Price must be a number" })
    .positive({ message: "Price must be positive" })
    .max(10000, "Price seems too high"), // Optional: sanity check max
});

const timeEntryLogSchema = z.object({
  rate_name: z.string().min(1, "Rate selection is required"),
  // Store price per hour for reference/calculation display, actual value copied on backend save
  rate_price_per_hour: z.number().positive().optional().nullable(),
  duration: z
    .number({ invalid_type_error: "Duration must be a number" })
    .positive({ message: "Duration must be positive" })
    .max(24, "Duration seems too long for a single entry"), // Max hours in a day
  description: z.string().min(1, "Description is required").max(1000),
  // Calculated amount is not part of the submittable schema usually
});

// M// Zod schema for the main WorkItem form
export const workItemSchema = z.object({
  name: z.string().min(1, "WorkItem name is required").max(150),
  // client_id should be a UUID string from the picker
  description: z.string().max(5000).optional().nullable().or(z.literal("")),

  timeEntries: z
    .array(timeEntryLogSchema)
    .min(1, "At least one time entry log is required"),

  invcoice_id: z.string().optional().nullable(),
  project_id: z
    .string()
    .uuid({ message: "Valid client must be selected" })
    .min(1, "Client is required"),
  // Use z.enum for predefined status values
  status: z.enum(workItemStatuses, {
    errorMap: () => ({ message: "Invalid status selected" }),
  }),
  // Define rates as an array of the rateSchema
  rates: z
    .array(paymentItemSchema)
    .min(1, "At least one rate must be defined") // Require at least one rate
    .max(10, "Maximum of 10 rates allowed") // Optional: limit number of rates
    .optional(), // Make the whole array optional initially if needed, or provide default
  // Add other fields like dates if necessary
  date_from: z.date().optional().nullable(),
  date_to: z.date().optional().nullable(),

  start_date: z.date().optional().nullable(),
  end_date: z.date().optional().nullable(),

  is_invoiced: z.boolean().optional().nullable(),
});
