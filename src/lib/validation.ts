import { z } from 'zod';

const WALLET_REGEX = /^[A-Z2-7]{58}$/;

const walletAddress = z.string().regex(WALLET_REGEX, 'Invalid Algorand wallet address (must be 58-char base32)');

export const scoreQuerySchema = z.object({
  query: z.object({
    wallet: walletAddress,
  }),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});
