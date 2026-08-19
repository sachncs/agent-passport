/**
 * Thin shim that exposes next-themes through the existing
 * useTheme() hook the Layout component consumes. Replaces 67 lines of
 * hand-rolled context (former apps/web/src/components/theme-provider.tsx).
 */

import { useTheme as useNextTheme } from 'next-themes';

export function useTheme() {
  const { theme, setTheme, resolvedTheme } = useNextTheme();
  return {
    theme: resolvedTheme ?? theme ?? 'light',
    setTheme,
  };
}