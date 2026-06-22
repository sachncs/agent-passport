import { describe, it, expect } from 'vitest';
import { scoreQuerySchema } from '../validation';

const VALID_WALLET = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ';

describe('Zod Validation Schemas', () => {
  describe('scoreQuerySchema', () => {
    it('accepts valid wallet address', () => {
      const result = scoreQuerySchema.safeParse({
        query: { wallet: VALID_WALLET },
        body: {},
        params: {},
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing wallet', () => {
      const result = scoreQuerySchema.safeParse({
        query: {},
        body: {},
        params: {},
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid wallet format', () => {
      const result = scoreQuerySchema.safeParse({
        query: { wallet: 'not-a-wallet' },
        body: {},
        params: {},
      });
      expect(result.success).toBe(false);
    });

    it('rejects wallet with wrong length', () => {
      const result = scoreQuerySchema.safeParse({
        query: { wallet: 'AAAA' },
        body: {},
        params: {},
      });
      expect(result.success).toBe(false);
    });

    it('rejects wallet with lowercase letters', () => {
      const result = scoreQuerySchema.safeParse({
        query: { wallet: 'abcde' + VALID_WALLET.slice(5) },
        body: {},
        params: {},
      });
      expect(result.success).toBe(false);
    });

    it('rejects wallet with special characters', () => {
      const result = scoreQuerySchema.safeParse({
        query: { wallet: '@'.repeat(58) },
        body: {},
        params: {},
      });
      expect(result.success).toBe(false);
    });

    it('rejects wallet that is too long', () => {
      const result = scoreQuerySchema.safeParse({
        query: { wallet: VALID_WALLET + 'A' },
        body: {},
        params: {},
      });
      expect(result.success).toBe(false);
    });
  });
});
