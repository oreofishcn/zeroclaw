import { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { getConfig, putConfig } from '@/lib/api';
import { t } from '@/lib/i18n';

export default function Config() {
  const [config, setConfig] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    getConfig()
      .then((data) => {
        setConfig(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await putConfig(config);
      setSuccess(t('config.save_success'));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('config.save_error'));
    } finally {
      setSaving(false);
    }
  };

  // Auto-dismiss success after 4 seconds
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(timer);
  }, [success]);

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-[#0080ff]" />
          <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider">{t('config.configuration_title')}</h2>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-electric flex items-center gap-2 text-sm px-4 py-2"
        >
          <Save className="h-4 w-4" />
          {saving ? t('config.saving') : t('config.save')}
        </button>
      </div>

      {/* Sensitive fields note */}
      <div className="flex items-start gap-3 rounded-xl p-4" style={{ border: '1px solid color-mix(in srgb, var(--color-status-warning) 18%, transparent)', background: 'color-mix(in srgb, var(--color-status-warning) 6%, transparent)' }}>
        <ShieldAlert className="h-5 w-5 text-[var(--color-status-warning)] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-[var(--color-status-warning)] font-medium">
            {t('config.sensitive_title')}
          </p>
          <p className="text-sm text-theme-muted mt-0.5">
            {t('config.sensitive_hint')}
          </p>
        </div>
      </div>

      {/* Success message */}
      {success && (
        <div className="flex items-center gap-2 rounded-xl p-3 animate-fade-in" style={{ border: '1px solid color-mix(in srgb, var(--color-status-success) 20%, transparent)', background: 'color-mix(in srgb, var(--color-status-success) 7%, transparent)' }}>
          <CheckCircle className="h-4 w-4 text-[var(--color-status-success)] flex-shrink-0" />
          <span className="text-sm text-[var(--color-status-success)]">{success}</span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl p-3 animate-fade-in" style={{ border: '1px solid color-mix(in srgb, var(--color-status-error) 22%, transparent)', background: 'color-mix(in srgb, var(--color-status-error) 7%, transparent)' }}>
          <AlertTriangle className="h-4 w-4 text-[var(--color-status-error)] flex-shrink-0" />
          <span className="text-sm text-[var(--color-status-error-soft)]">{error}</span>
        </div>
      )}

      {/* Config Editor */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border-default)]" style={{ background: 'var(--color-accent-blue-soft)' }}>
          <span className="text-[10px] text-theme-faint font-semibold uppercase tracking-wider">
            {t('config.toml_label')}
          </span>
          <span className="text-[10px] text-theme-faint">
            {config.split('\n').length} {t('config.lines')}
          </span>
        </div>
        <textarea
          value={config}
          onChange={(e) => setConfig(e.target.value)}
          spellCheck={false}
          className="w-full min-h-[500px] text-theme-secondary font-mono text-sm p-4 resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)]/30 focus:ring-inset"
          style={{ background: 'var(--color-bg-input)', tabSize: 4 }}
        />
      </div>
    </div>
  );
}
