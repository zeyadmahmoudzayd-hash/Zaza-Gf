import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';

export function TopBar() {
  const { data, activeView, setActiveView, openPage, openAuthModal } = usePlatform();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!data) return null;
  const { settings, navLinks, user } = data;
  const visibleLinks = navLinks.slice(0, 5);

  const handleNavClick = (target: string) => {
    setMobileOpen(false);
    if (target.startsWith('/page/')) {
      openPage(target.replace('/page/', ''));
      return;
    }
    if (target.startsWith('#')) {
      if (activeView !== 'home') {
        setActiveView('home');
        window.setTimeout(() => {
          document.getElementById(target.slice(1))?.scrollIntoView({ behavior: 'smooth' });
        }, 80);
      } else {
        document.getElementById(target.slice(1))?.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }
    setActiveView('home');
  };

  const handlePrimaryCta = () => {
    setMobileOpen(false);
    if (!user) {
      openAuthModal('login');
      return;
    }
    setActiveView(user.role === 'admin' ? 'admin' : 'student');
  };

  const primaryCtaLabel = !user
    ? 'Sign In'
    : user.role === 'admin'
      ? activeView === 'admin'
        ? 'View Site'
        : 'Admin Console'
      : activeView === 'student'
        ? 'Browse Site'
        : 'Student Portal';

  const onPrimaryClick = () => {
    if (!user) return handlePrimaryCta();
    if (user.role === 'admin') {
      setActiveView(activeView === 'admin' ? 'home' : 'admin');
    } else {
      setActiveView(activeView === 'student' ? 'home' : 'student');
    }
  };

  return (
    <header
      className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur-sm"
      style={{ borderColor: 'rgba(15, 23, 42, 0.08)' }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => {
            setActiveView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          {settings.logo_url ? (
            <img
              src={settings.logo_url}
              alt={settings.platform_name}
              referrerPolicy="no-referrer"
              className="h-8 w-8 rounded-md object-cover"
            />
          ) : (
            <span
              className="flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold tracking-tight text-white"
              style={{ backgroundColor: 'var(--brand-navy)' }}
            >
              ZX
            </span>
          )}
          <span
            className="font-display text-lg font-bold tracking-tight whitespace-nowrap shrink-0"
            style={{ color: 'var(--brand-navy)' }}
          >
            {settings.platform_name}
          </span>
        </button>

        {/* Zone 2: 4-5 Concise Single-Line Text Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          {visibleLinks.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => handleNavClick(link.target)}
              className="whitespace-nowrap shrink-0 py-1 transition-colors hover:text-slate-950 hover:underline hover:underline-offset-4"
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onPrimaryClick}
            className="hidden sm:inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition-transform duration-150 active:scale-[0.98] whitespace-nowrap shrink-0"
            style={{ backgroundColor: 'var(--brand-navy)' }}
          >
            {primaryCtaLabel}
          </button>

          <button
            type="button"
            aria-label="Toggle navigation menu"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
          <div className="flex flex-col gap-2">
            {visibleLinks.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => handleNavClick(link.target)}
                className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {link.label}
              </button>
            ))}
            <button
              type="button"
              onClick={onPrimaryClick}
              className="mt-2 rounded-lg px-4 py-2.5 text-center text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--brand-navy)' }}
            >
              {primaryCtaLabel}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
