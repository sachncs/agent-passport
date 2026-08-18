import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Shield,
  Award,
  Activity,
  Users,
  Scale,
  Star,
  Search,
  Server,
  Briefcase,
  HandCoins,
  Moon,
  Sun,
  Github,
} from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/score', label: 'Trust Score', icon: Shield },
  { href: '/passport', label: 'Passport', icon: Award },
  { href: '/underwrite', label: 'Underwrite', icon: Scale },
  { href: '/delegation', label: 'Delegation', icon: Users },
  { href: '/sybil', label: 'Sybil Check', icon: Activity },
  { href: '/reputation', label: 'Reputation', icon: Star },
  { href: '/counterparty', label: 'Counterparty', icon: Briefcase },
  { href: '/endorse', label: 'Endorse / Revoke', icon: HandCoins },
  { href: '/discovery', label: 'Bazaar', icon: Search },
  { href: '/monitor', label: 'Monitor', icon: Server },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined'
    && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Shield className="h-5 w-5 text-primary" />
            <span className="hidden sm:inline">Agent Passport</span>
          </Link>
          <Separator orientation="vertical" className="h-6" />
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const active = location.pathname === item.href
                || (item.href !== '/' && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="icon" asChild aria-label="GitHub">
              <a
                href="https://github.com/sachncs/agent-passport"
                target="_blank"
                rel="noreferrer"
              >
                <Github className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {children}
      </main>
      <footer className="border-t border-border py-6">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs text-muted-foreground sm:px-6">
          Agent Passport — stateless trust & underwriting for AI agents on Algorand.
        </div>
      </footer>
    </div>
  );
}