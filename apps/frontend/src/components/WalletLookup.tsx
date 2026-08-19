import { useEffect, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { isValidWallet } from '@/lib/wallet';
import { cn } from '@/lib/utils';

interface WalletLookupProps {
  value?: string;
  onSubmit: (wallet: string) => void;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  buttonText?: string;
  autoFocus?: boolean;
}

export function WalletLookup({
  value,
  onSubmit,
  placeholder = 'Algorand wallet address (58 chars A-Z, 2-7)',
  className,
  size = 'md',
  buttonText = 'Look up',
  autoFocus,
}: WalletLookupProps) {
  const [text, setText] = useState(value ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (value !== undefined) setText(value);
  }, [value]);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Enter an Algorand wallet address.');
      return;
    }
    if (!isValidWallet(trimmed)) {
      setError('Invalid wallet. Must be 58-character base32 (A-Z, 2-7).');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      onSubmit(trimmed);
    } finally {
      setLoading(false);
    }
  };

  const inputSize = size === 'lg' ? 'h-12' : size === 'sm' ? 'h-9' : 'h-10';
  const buttonSize = size === 'lg' ? 'h-12 px-6' : size === 'sm' ? 'h-9 px-3' : 'h-10 px-4';
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={cn('flex-1 wallet-mono', inputSize)}
          aria-label="Algorand wallet address"
        />
        <Button onClick={submit} disabled={loading} className={buttonSize}>
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Search className="mr-2 h-4 w-4" />}
          {!loading && buttonText}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}