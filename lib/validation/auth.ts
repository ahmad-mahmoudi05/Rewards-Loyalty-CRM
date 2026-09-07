import { z } from "zod";

export const SignupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name."),
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const LoginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const ForgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address."),
});

export const ResetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters."),
});
