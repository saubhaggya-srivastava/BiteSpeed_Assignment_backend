import { z } from 'zod';

export const IdentifyRequestSchema = z
  .object({
    email: z.string().email().optional().or(z.literal('')),
    phoneNumber: z.string().optional().or(z.literal('')),
  })
  .refine(
    (data) => {
      const hasEmail = data.email && data.email.trim() !== '';
      const hasPhone = data.phoneNumber && data.phoneNumber.trim() !== '';
      return hasEmail || hasPhone;
    },
    {
      message: 'At least one of email or phoneNumber must be provided',
    }
  );

export type IdentifyRequest = z.infer<typeof IdentifyRequestSchema>;

export interface IdentifyResponse {
  contact: {
    primaryContactId: number;
    emails: string[];
    phoneNumbers: string[];
    secondaryContactIds: number[];
  };
}
