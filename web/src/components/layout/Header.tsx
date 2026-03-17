import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { LogOut, MoonStar, Settings, SunMedium } from 'lucide-react';
import { t } from '@/lib/i18n';
import { useLocaleContext, useThemeContext } from '@/App';
import { useAuth } from '@/hooks/useAuth';
import { SettingsModal } from '@/components/SettingsModal';

const routeTitles: Record<string, string> = {
  '/': 'nav.dashboard',
  '/agent': 'nav.agent',
  '/tools': 'nav.tools',
  '/cron': 'nav.cron',
  '/integrations': 'nav.integrations',
  '/memory': 'nav.memory',
  '/config': 'nav.config',
  '/cost': 'nav.cost',
  '/logs': 'nav.logs',
  '/doctor': 'nav.doctor',
};

export default function Header() {
  const location = useLocation();
  const { logout } = useAuth();
  const { locale, setAppLocale } = useLocaleContext();
  const { theme, toggleAppTheme } = useThemeContext();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const titleKey = routeTitles[location.pathname] ?? 'nav.dashboard';
  const pageTitle = t(titleKey);

  const toggleLanguage = () => {
    // Cycle through: en -> zh -> tr -> en
    const nextLocale = locale === 'en' ? 'zh' : locale === 'zh' ? 'tr' : 'en';
    setAppLocale(nextLocale);
  };

  return (
    <>
      <header className="theme-header h-14 flex items-center justify-between px-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="hidden md:inline-flex theme-chip text-[11px] font-semibold">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-accent-blue)] glow-dot" />
            Control Surface
          </div>
          <h1 className="text-lg font-semibold text-theme-primary tracking-tight">{pageTitle}</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleAppTheme}
            className="theme-toggle group inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-300"
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            <span className="theme-toggle-icon">
              {theme === 'dark' ? (
                <SunMedium className="h-3.5 w-3.5" />
              ) : (
                <MoonStar className="h-3.5 w-3.5" />
              )}
            </span>
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="theme-header-button inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-300"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>{t('settings.title')}</span>
          </button>

          <button
            type="button"
            onClick={toggleLanguage}
            className="theme-header-button px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-300"
            title={
              locale === 'en'
                ? 'Switch to Chinese'
                : locale === 'zh'
                  ? 'Switch to Turkish'
                  : 'Switch to English'
            }
          >
            {locale === 'en' ? 'EN' : locale === 'zh' ? 'ZH' : 'TR'}
          </button>

          <button
            type="button"
            onClick={logout}
            className="theme-logout-button flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-300"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{t('auth.logout')}</span>
          </button>
        </div>
      </header>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
