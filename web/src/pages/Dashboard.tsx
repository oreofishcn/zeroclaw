import { useState, useEffect } from 'react';
import {
  Cpu,
  Clock,
  Globe,
  Database,
  Activity,
  DollarSign,
  Radio,
} from 'lucide-react';
import type { StatusResponse, CostSummary } from '@/types/api';
import { getStatus, getCost } from '@/lib/api';
import { t } from '@/lib/i18n';

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatUSD(value: number): string {
  return `$${value.toFixed(4)}`;
}

function healthColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'ok':
    case 'healthy':
      return 'bg-[#00e68a]';
    case 'warn':
    case 'warning':
    case 'degraded':
      return 'bg-[#ffaa00]';
    default:
      return 'bg-[#ff4466]';
  }
}

function healthBorder(status: string): string {
  switch (status.toLowerCase()) {
    case 'ok':
    case 'healthy':
      return 'border-[#00e68a30]';
    case 'warn':
    case 'warning':
    case 'degraded':
      return 'border-[#ffaa0030]';
    default:
      return 'border-[#ff446630]';
  }
}

export default function Dashboard() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [cost, setCost] = useState<CostSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllChannels, setShowAllChannels] = useState(false);

  useEffect(() => {
    Promise.all([getStatus(), getCost()])
      .then(([s, c]) => {
        setStatus(s);
        setCost(c);
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="p-6 animate-fade-in">
        <div
          className="rounded-xl p-4 text-[var(--color-status-error-soft)]"
          style={{
            background:
              'color-mix(in srgb, var(--color-status-error) 10%, transparent)',
            border:
              '1px solid color-mix(in srgb, var(--color-status-error) 22%, transparent)',
          }}
        >
          {t('dashboard.load_error')}: {error}
        </div>
      </div>
    );
  }

  if (!status || !cost) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="theme-spinner h-8 w-8 rounded-full animate-spin" />
      </div>
    );
  }

  const maxCost = Math.max(
    cost.session_cost_usd,
    cost.daily_cost_usd,
    cost.monthly_cost_usd,
    0.001,
  );
  const componentStatuses = Object.values(status.health.components).map(
    (component) => component.status.toLowerCase(),
  );
  const overallHealth = componentStatuses.some(
    (state) => state === 'error' || state === 'failed',
  )
    ? 'error'
    : componentStatuses.some(
          (state) =>
            state === 'warn' ||
            state === 'warning' ||
            state === 'degraded',
        )
      ? 'warning'
      : 'healthy';

  return (
    <div className="theme-page space-y-6 animate-fade-in">
      <section className="theme-hero-card">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="theme-eyebrow">Overview</p>
            <h2 className="theme-title mt-3">System status in a softer light.</h2>
            <p className="theme-subtitle mt-3">
              The dashboard now follows the same bright control-panel language
              as the reference panels: muted surfaces, airy spacing, pale blue
              emphasis, and clearer status groupings.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="theme-chip text-xs font-semibold">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${healthColor(overallHealth)} glow-dot`}
                />
                {overallHealth}
              </span>
              <span className="theme-chip text-xs font-semibold">
                <Cpu className="h-3.5 w-3.5 text-[var(--color-accent-blue)]" />
                {status.provider ?? 'Unknown'}
              </span>
              <span className="theme-chip text-xs font-semibold">
                <Clock className="h-3.5 w-3.5 text-[var(--color-status-success)]" />
                {formatUptime(status.uptime_seconds)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: 'Gateway', value: `:${status.gateway_port}` },
              { label: 'Memory', value: status.memory_backend },
              { label: 'Locale', value: status.locale },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="theme-stat-tile min-w-[8.5rem] px-4 py-3"
              >
                <p className="text-[10px] uppercase tracking-[0.18em] text-theme-faint">
                  {label}
                </p>
                <p className="mt-1 text-sm font-semibold text-theme-primary truncate">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
        {[
          {
            icon: Cpu,
            color: '#0080ff',
            bg: '#0080ff15',
            label: t('dashboard.provider_model'),
            value: status.provider ?? 'Unknown',
            sub: status.model,
          },
          {
            icon: Clock,
            color: '#00e68a',
            bg: '#00e68a15',
            label: t('dashboard.uptime'),
            value: formatUptime(status.uptime_seconds),
            sub: t('dashboard.since_last_restart'),
          },
          {
            icon: Globe,
            color: '#a855f7',
            bg: '#a855f715',
            label: t('dashboard.gateway_port'),
            value: `:${status.gateway_port}`,
            sub: '',
          },
          {
            icon: Database,
            color: '#ff8800',
            bg: '#ff880015',
            label: t('dashboard.memory_backend'),
            value: status.memory_backend,
            sub: `${t('dashboard.paired')}: ${status.paired ? t('dashboard.paired_yes') : t('dashboard.paired_no')}`,
          },
        ].map(({ icon: Icon, color, bg, label, value, sub }) => (
          <div key={label} className="glass-card p-5 animate-slide-in-up">
            <div className="mb-3 flex items-center gap-3">
              <div
                className="rounded-xl p-2"
                style={{
                  background: bg,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
                }}
              >
                <Icon className="h-5 w-5" style={{ color }} />
              </div>
              <span className="text-xs font-medium uppercase tracking-wider text-theme-muted">
                {label}
              </span>
            </div>
            <p className="truncate text-lg font-semibold capitalize text-theme-primary">
              {value}
            </p>
            <p className="truncate text-sm text-theme-muted">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 stagger-children">
        <div className="glass-card p-5 animate-slide-in-up">
          <div className="mb-5 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-[#0080ff]" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-theme-primary">
              {t('dashboard.cost_overview')}
            </h2>
          </div>
          <div className="space-y-4">
            {[
              {
                label: t('dashboard.session_label'),
                value: cost.session_cost_usd,
                color: '#0080ff',
              },
              {
                label: t('dashboard.daily_label'),
                value: cost.daily_cost_usd,
                color: '#00e68a',
              },
              {
                label: t('dashboard.monthly_label'),
                value: cost.monthly_cost_usd,
                color: '#a855f7',
              },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="text-theme-muted">{label}</span>
                  <span className="font-mono font-medium text-theme-primary">
                    {formatUSD(value)}
                  </span>
                </div>
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full"
                  style={{ background: 'var(--color-bg-track)' }}
                >
                  <div
                    className="progress-bar-animated h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${Math.max((value / maxCost) * 100, 2)}%`,
                      background: color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-between border-t border-[var(--color-border-default)]/70 pt-4 text-sm">
            <span className="text-theme-muted">
              {t('dashboard.total_tokens_label')}
            </span>
            <span className="font-mono text-theme-primary">
              {cost.total_tokens.toLocaleString()}
            </span>
          </div>
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-theme-muted">
              {t('dashboard.requests_label')}
            </span>
            <span className="font-mono text-theme-primary">
              {cost.request_count.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="glass-card p-5 animate-slide-in-up">
          <div className="mb-5 flex items-center gap-2">
            <Radio className="h-5 w-5 text-[#0080ff]" />
            <h2 className="flex-1 text-sm font-semibold uppercase tracking-wider text-theme-primary">
              {t('dashboard.channels')}
            </h2>
            <button
              onClick={() => setShowAllChannels((value) => !value)}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-200"
              style={{
                background: showAllChannels
                  ? 'rgba(0,128,255,0.15)'
                  : 'rgba(0,230,138,0.12)',
                color: showAllChannels ? '#0080ff' : '#00e68a',
                border: showAllChannels
                  ? '1px solid rgba(0,128,255,0.3)'
                  : '1px solid rgba(0,230,138,0.3)',
              }}
              aria-label={
                showAllChannels
                  ? t('dashboard.filter_active')
                  : t('dashboard.filter_all')
              }
            >
              {showAllChannels
                ? t('dashboard.filter_all')
                : t('dashboard.filter_active')}
            </button>
          </div>
          <div className="space-y-2">
            {Object.entries(status.channels).length === 0 ? (
              <p className="text-sm text-theme-faint">
                {t('dashboard.no_channels')}
              </p>
            ) : (
              (() => {
                const entries = Object.entries(status.channels).filter(
                  ([, active]) => showAllChannels || active,
                );
                if (entries.length === 0) {
                  return (
                    <p className="text-sm text-theme-faint">
                      {t('dashboard.no_active_channels')}
                    </p>
                  );
                }
                return entries.map(([name, active]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-all duration-300 hover:bg-[#0080ff08]"
                    style={{
                      background:
                        'color-mix(in srgb, var(--color-accent-blue) 5%, var(--color-bg-card))',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)',
                    }}
                  >
                    <span className="text-sm font-medium capitalize text-theme-primary">
                      {name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2 w-2 rounded-full glow-dot ${
                          active
                            ? 'text-[#00e68a] bg-[#00e68a]'
                            : 'text-[#334060] bg-[#334060]'
                        }`}
                      />
                      <span className="text-xs text-theme-muted">
                        {active
                          ? t('dashboard.active')
                          : t('dashboard.inactive')}
                      </span>
                    </div>
                  </div>
                ));
              })()
            )}
          </div>
        </div>

        <div className="glass-card p-5 animate-slide-in-up">
          <div className="mb-5 flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#0080ff]" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-theme-primary">
              {t('dashboard.component_health')}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(status.health.components).length === 0 ? (
              <p className="col-span-2 text-sm text-theme-faint">
                {t('dashboard.no_components')}
              </p>
            ) : (
              Object.entries(status.health.components).map(([name, comp]) => (
                <div
                  key={name}
                  className={`rounded-xl border p-3 transition-all duration-300 hover:scale-[1.02] ${healthBorder(comp.status)}`}
                  style={{
                    background:
                      'color-mix(in srgb, var(--color-accent-blue) 5%, var(--color-bg-card))',
                  }}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${healthColor(comp.status)} glow-dot`}
                    />
                    <span className="truncate text-sm font-medium capitalize text-theme-primary">
                      {name}
                    </span>
                  </div>
                  <p className="text-xs capitalize text-theme-muted">
                    {comp.status}
                  </p>
                  {comp.restart_count > 0 && (
                    <p className="mt-1 text-xs text-[#ffaa00]">
                      {t('dashboard.restarts')}: {comp.restart_count}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
