import { z } from 'zod/v4';

export const m365ConnectionSchema = z.object({
	name: z.string().min(1, 'Name is required').max(50)
});
