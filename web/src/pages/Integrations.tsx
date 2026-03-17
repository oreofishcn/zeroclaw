import { useState, useEffect } from 'react';
import { Puzzle, Check, Zap, Clock } from 'lucide-react';
import type { Integration } from '@/types/api';
import { getIntegrations } from '@/lib/api';
import { t } from '@/lib/i18n';

function statusBadge(status: Integration['status']) {
  switch (status) {
    case 'Active':
      return {
        icon: Check,
        label: t('integrations.status_active'),
        classes: 'text-[#00e68a] border-[#00e68a30]',
        bg: 'rgba(0,230,138,0.06)',
      };
    case 'Available':
      return {
        icon: Zap,
        label: t('integrations.status_available'),
        classes: 'text-[#0080ff] border-[#0080ff30]',
        bg: 'rgba(0,128,255,0.06)',
      };
    case 'ComingSoon':
      return {
        icon: Clock,
        label: t('integrations.status_coming_soon'),
        classes: 'text-[#556080] border-[#1a1a3e]',
        bg: 'rgba(26,26,62,0.3)',
      };
  }
}

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  useEffect(() => {
    getIntegrations()
      .then(setIntegrations)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const categories = [
    'all',
    ...Array.from(new Set(integrations.map((i) => i.category))).sort(),
  ];

  const filtered =
    activeCategory === 'all'
      ? integrations
      : integrations.filter((i) => i.category === activeCategory);

  // Group by category for display
  const grouped = filtered.reduce<Record<string, Integration[]>>((acc, item) => {
    const key = item.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  if (error) {
    return (
      <div className="p-6 animate-fade-in">
        <div className="rounded-xl p-4 text-[var(--color-status-error-soft)]" style={{ background: 'color-mix(in srgb, var(--color-status-error) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-status-error) 22%, transparent)' }}>
          {t('integrations.load_error')}: {error}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="theme-spinner h-8 w-8 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Puzzle className="h-5 w-5 text-[#0080ff]" />
        <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider">
          {t('integrations.title')} ({integrations.length})
        </h2>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-300 capitalize ${activeCategory === cat
                ? 'text-white shadow-[0_0_15px_rgba(0,128,255,0.2)]'
                : 'text-theme-muted border border-[var(--color-border-default)] hover:text-theme-primary hover:border-[var(--color-border-strong)]'
            }`}
            style={activeCategory === cat ? { background: 'linear-gradient(135deg, var(--color-accent-blue), var(--color-accent-blue-hover))' } : {}}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grouped Integration Cards */}
      {Object.keys(grouped).length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Puzzle className="h-10 w-10 text-[var(--color-border-strong)] mx-auto mb-3" />
          <p className="text-theme-muted">{t('integrations.empty')}</p>
        </div>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([category, items]) => (
            <div key={category}>
              <h3 className="text-[10px] font-semibold text-theme-faint uppercase tracking-wider mb-3 capitalize">
                {category}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
                {items.map((integration) => {
                  const badge = statusBadge(integration.status);
                  const BadgeIcon = badge.icon;
                  return (
                    <div
                      key={integration.name}
                      className="glass-card p-5 animate-slide-in-up"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-theme-primary truncate">
                            {integration.name}
                          </h4>
                          <p className="text-sm text-theme-muted mt-1 line-clamp-2">
                            {integration.description}
                          </p>
                        </div>
                        <span
                          className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${badge.classes}`}
                          style={{ background: badge.bg }}
                        >
                          <BadgeIcon className="h-3 w-3" />
                          {badge.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
      )}
    </div>
  );
}
