import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Wrench,
  Clock,
  Puzzle,
  Brain,
  Settings,
  DollarSign,
  Activity,
  Stethoscope,
} from 'lucide-react';
import { t } from '@/lib/i18n';

const navItems = [
  { to: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { to: '/agent', icon: MessageSquare, labelKey: 'nav.agent' },
  { to: '/tools', icon: Wrench, labelKey: 'nav.tools' },
  { to: '/cron', icon: Clock, labelKey: 'nav.cron' },
  { to: '/integrations', icon: Puzzle, labelKey: 'nav.integrations' },
  { to: '/memory', icon: Brain, labelKey: 'nav.memory' },
  { to: '/config', icon: Settings, labelKey: 'nav.config' },
  { to: '/cost', icon: DollarSign, labelKey: 'nav.cost' },
  { to: '/logs', icon: Activity, labelKey: 'nav.logs' },
  { to: '/doctor', icon: Stethoscope, labelKey: 'nav.doctor' },
];

export default function Sidebar() {
  return (
    <aside className="theme-sidebar sticky top-0 h-screen w-60 flex flex-col">
      {/* Glow line on right edge */}
      <div className="sidebar-glow-line" />

      {/* Logo / Title */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[var(--color-border-default)]/70">
        <img
          src="/_app/zeroclaw-trans.png"
          alt="ZeroClaw"
          className="theme-logo h-10 w-10 rounded-xl object-cover animate-pulse-glow"
        />
        <span className="text-lg font-bold text-gradient-blue tracking-wide">
          ZeroClaw
        </span>
      </div>
      <div className="px-4 pt-4">
        <div className="theme-stat-tile px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-theme-faint">Workspace</p>
          <p className="mt-1 text-xs font-semibold text-theme-primary">Agent Control Center</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5">
        {navItems.map(({ to, icon: Icon, labelKey }, idx) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 animate-slide-in-left group',
                isActive
                  ? 'theme-nav-active shadow-[0_12px_28px_var(--color-accent-shadow)]'
                  : 'text-theme-muted hover:text-theme-primary hover:bg-[var(--color-accent-blue-soft)]',
              ].join(' ')
            }
            style={({ isActive }) => ({
              animationDelay: `${idx * 40}ms`,
              ...(isActive ? { background: 'var(--color-accent-panel)' } : {}),
            })}
          >
            {({ isActive }) => (
              <>
                <Icon className={`h-5 w-5 flex-shrink-0 transition-colors duration-300 ${isActive ? 'text-[var(--color-accent-blue)]' : 'group-hover:text-[var(--color-accent-blue)]'}`} />
                <span>{t(labelKey)}</span>
                {isActive && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--color-accent-blue)] glow-dot" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-[var(--color-border-default)]/70">
        <p className="text-[10px] text-theme-faint tracking-wider uppercase">ZeroClaw Runtime</p>
      </div>
    </aside>
  );
}
