// frontend/src/features/clients/clientSchema.js
import { z } from "zod"; // Zod library itself works in JavaScript

// --- Zod Schema Definition (This is JavaScript) ---
export const clientSchema = z.object({
  name: z.string().min(1, { message: "Client name is required" }).max(100),
  // Allow empty string OR valid email OR null/undefined
  email: z
    .string()
    .email({ message: "Invalid email address" })
    .optional()
    .nullable()
    .or(z.literal("")),
  address_street: z.string().max(100).optional().nullable().or(z.literal("")),
  address_zip: z.string().max(20).optional().nullable().or(z.literal("")),
  address_city: z.string().max(100).optional().nullable().or(z.literal("")),
  address_country: z.string().max(100).optional().nullable().or(z.literal("")),
  vat_id: z.string().max(50).optional().nullable().or(z.literal("")),
  contact_person: z.string().max(100).optional().nullable().or(z.literal("")),
  phone: z.string().max(50).optional().nullable().or(z.literal("")), // Optional: Add regex validation later
  notes: z.string().max(5000).optional().nullable().or(z.literal("")),
});
// ---------------------------------------------------

// --- Remove TypeScript Type Export ---
// export type ClientFormData = z.infer<typeof clientSchema>; // <<< REMOVE THIS LINE
// -------------------------------------

// In JavaScript, you don't export a static type this way.
// The `clientSchema` object itself is what you import and use
// with libraries like react-hook-form's zodResolver for validation.
// If you need to refer to the expected shape in comments or documentation,
// you'd typically describe it based on the schema fields above.
