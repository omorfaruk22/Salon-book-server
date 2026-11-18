import { z } from "zod";

export const checkoutSchema = z.object({ appointmentId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid appointment id") }).strict();
