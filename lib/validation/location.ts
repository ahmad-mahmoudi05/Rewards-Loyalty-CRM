import { z } from "zod";

export const CreateLocationSchema = z.object({
  name: z.string().trim().min(2, "Enter a location name."),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
});
