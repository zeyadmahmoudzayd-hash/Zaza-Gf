import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch, setAuthToken } from '../lib/api';
import type { AuthUser, BootstrapData, SiteSettings } from '../types/platform';

export type ActiveView = 'home' | 'course' | 'student' | 'admin' | 'page';

interface PlatformContextValue {
  data: BootstrapData | null;
  loading: boolean;
  error: string | null;
  activeView: ActiveView;
  selectedCourseId: number | null;
  selectedPageSlug: string | null;
  authModalOpen: boolean;
  authInitialMode: 'login' | 'register';
  checkoutPlanId: number | null;
  toastMessage: string | null;
  setActiveView: (view: ActiveView) => void;
  openCourse: (courseId: number) => void;
  openPage: (slug: string) => void;
  openAuthModal: (mode?: 'login' | 'register') => void;
  closeAuthModal: () => void;
  openCheckout: (planId?: number) => void;
  closeCheckout: () => void;
  showToast: (msg: string) => void;
  refreshBootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (payload: Record<string, string>) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

function applyTheme(settings?: SiteSettings) {
  if (!settings) return;
  const root = document.documentElement;
  if (settings.theme_navy) root.style.setProperty('--brand-navy', settings.theme_navy);
  if (settings.theme_blue) root.style.setProperty('--brand-blue', settings.theme_blue);
  if (settings.theme_gold) root.style.setProperty('--brand-gold', settings.theme_gold);
  if (settings.theme_bg) root.style.setProperty('--brand-bg', settings.theme_bg);
  if (settings.platform_name) {
    document.title = `${settings.platform_name} – Professional Educational Platform`;
  }
}

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedPageSlug, setSelectedPageSlug] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [checkoutPlanId, setCheckoutPlanId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  }, []);

  const refreshBootstrap = useCallback(async () => {
    try {
      const res = await apiFetch<BootstrapData>('/api/public/bootstrap');
      setData(res);
      applyTheme(res.settings);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load platform data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBootstrap();
  }, [refreshBootstrap]);

  const openCourse = useCallback((courseId: number) => {
    setSelectedCourseId(courseId);
    setActiveView('course');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openPage = useCallback((slug: string) => {
    setSelectedPageSlug(slug);
    setActiveView('page');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openAuthModal = useCallback((mode: 'login' | 'register' = 'login') => {
    setAuthInitialMode(mode);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => setAuthModalOpen(false), []);

  const openCheckout = useCallback(
    (planId?: number) => {
      if (!data?.user) {
        setAuthInitialMode('register');
        setAuthModalOpen(true);
        showToast('Please sign in or register an account to subscribe.');
        return;
      }
      const targetId = planId || data?.plans?.[0]?.id || 1;
      setCheckoutPlanId(targetId);
    },
    [data, showToast],
  );

  const closeCheckout = useCallback(() => setCheckoutPlanId(null), []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiFetch<{ token: string; user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAuthToken(res.token);
      await refreshBootstrap();
      setAuthModalOpen(false);
      showToast(`Welcome back, ${res.user.full_name}`);
      return res.user;
    },
    [refreshBootstrap, showToast],
  );

  const register = useCallback(
    async (payload: Record<string, string>) => {
      const res = await apiFetch<{ token: string; user: AuthUser }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setAuthToken(res.token);
      await refreshBootstrap();
      setAuthModalOpen(false);
      showToast(`Account created for ${res.user.full_name}`);
      return res.user;
    },
    [refreshBootstrap, showToast],
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAuthToken(null);
    setActiveView('home');
    await refreshBootstrap();
    showToast('Signed out.');
  }, [refreshBootstrap, showToast]);

  return (
    <PlatformContext.Provider
      value={{
        data,
        loading,
        error,
        activeView,
        selectedCourseId,
        selectedPageSlug,
        authModalOpen,
        authInitialMode,
        checkoutPlanId,
        toastMessage,
        setActiveView,
        openCourse,
        openPage,
        openAuthModal,
        closeAuthModal,
        openCheckout,
        closeCheckout,
        showToast,
        refreshBootstrap,
        login,
        register,
        logout,
      }}
    >
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform must be used within PlatformProvider');
  return ctx;
}
