import { useState, useEffect } from 'react';
import {
  Wrench,
  Search,
  ChevronDown,
  ChevronRight,
  Terminal,
  Package,
} from 'lucide-react';
import type { ToolSpec, CliTool } from '@/types/api';
import { getTools, getCliTools } from '@/lib/api';
import { t } from '@/lib/i18n';

export default function Tools() {
  const [tools, setTools] = useState<ToolSpec[]>([]);
  const [cliTools, setCliTools] = useState<CliTool[]>([]);
  const [search, setSearch] = useState('');
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getTools(), getCliTools()])
      .then(([t, c]) => {
        setTools(t);
        setCliTools(c);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = tools.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()),
  );

  const filteredCli = cliTools.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase()),
  );

  if (error) {
    return (
      <div className="p-6 animate-fade-in">
        <div className="rounded-xl p-4 text-[var(--color-status-error-soft)]" style={{ background: 'color-mix(in srgb, var(--color-status-error) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-status-error) 22%, transparent)' }}>
          {t('tools.load_error')}: {error}
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
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#334060]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('tools.search')}
          className="input-electric w-full pl-10 pr-4 py-2.5 text-sm"
        />
      </div>

      {/* Agent Tools Grid */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Wrench className="h-5 w-5 text-[#0080ff]" />
          <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider">
            {t('tools.agent_tools')} ({filtered.length})
          </h2>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-theme-faint">{t('tools.empty')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
            {filtered.map((tool) => {
              const isExpanded = expandedTool === tool.name;
              return (
                <div
                  key={tool.name}
                  className="glass-card overflow-hidden animate-slide-in-up"
                >
                  <button
                    onClick={() =>
                      setExpandedTool(isExpanded ? null : tool.name)
                    }
                    className="w-full text-left p-4 hover:bg-[var(--color-accent-blue-soft)] transition-all duration-300"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Package className="h-4 w-4 text-[#0080ff] flex-shrink-0 mt-0.5" />
                        <h3 className="text-sm font-semibold text-theme-primary truncate">
                          {tool.name}
                        </h3>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-[#0080ff] flex-shrink-0 transition-transform" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-theme-faint flex-shrink-0 transition-transform" />
                      )}
                    </div>
                    <p className="text-sm text-theme-muted mt-2 line-clamp-2">
                      {tool.description}
                    </p>
                  </button>

                  {isExpanded && tool.parameters && (
                    <div className="border-t border-[var(--color-border-default)] p-4 animate-fade-in">
                      <p className="text-[10px] text-theme-faint mb-2 font-semibold uppercase tracking-wider">
                        {t('tools.parameter_schema')}
                      </p>
                      <pre className="text-xs text-theme-secondary rounded-xl p-3 overflow-x-auto max-h-64 overflow-y-auto" style={{ background: 'var(--color-bg-input)' }}>
                        {JSON.stringify(tool.parameters, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CLI Tools Section */}
      {filteredCli.length > 0 && (
        <div className="animate-slide-in-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <Terminal className="h-5 w-5 text-[#00e68a]" />
            <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider">
              {t('tools.cli_tools')} ({filteredCli.length})
            </h2>
          </div>

          <div className="glass-card overflow-hidden">
            <table className="table-electric">
              <thead>
                <tr>
                  <th className="text-left">{t('tools.name')}</th>
                  <th className="text-left">{t('tools.path')}</th>
                  <th className="text-left">{t('tools.version')}</th>
                  <th className="text-left">{t('tools.category')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredCli.map((tool) => (
                  <tr key={tool.name}>
                    <td className="px-4 py-3 text-theme-primary font-medium text-sm">
                      {tool.name}
                    </td>
                    <td className="px-4 py-3 text-theme-muted font-mono text-xs truncate max-w-[200px]">
                      {tool.path}
                    </td>
                    <td className="px-4 py-3 text-theme-muted text-sm">
                      {tool.version ?? '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold capitalize border text-theme-secondary" style={{ borderColor: 'var(--color-border-default)', background: 'var(--color-accent-blue-soft)' }}>
                        {tool.category}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
