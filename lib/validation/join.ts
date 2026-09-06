import { z } from "zod";

export const JoinFormSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name."),
  phone: z.string().trim().min(5, "Enter your mobile number."),
  email: z.union([z.email("Enter a valid email address."), z.literal("")]).optional(),
  birthday: z.string().optional(),
  whatsappConsent: z.boolean().default(false),
  smsConsent: z.boolean().default(false),
  emailConsent: z.boolean().default(false),
});

export type JoinFormValues = z.infer<typeof JoinFormSchema>;
