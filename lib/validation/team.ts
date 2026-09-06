import { z } from "zod";

export const InviteStaffSchema = z.object({
  fullName: z.string().trim().min(2, "Enter their full name."),
  email: z.email("Enter a valid email address."),
  role: z.enum(["STAFF", "MANAGER"]),
});
