import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Plus,
  Trash2,
  X,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import type { CronJob, CronRun } from '@/types/api';
import {
  getCronJobs,
  addCronJob,
  deleteCronJob,
  getCronRuns,
  getCronSettings,
  patchCronSettings,
} from '@/lib/api';
import type { CronSettings } from '@/lib/api';
import { t } from '@/lib/i18n';

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString();
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return '-';
  if (ms < 1000) return `${ms}ms`;
  const secs = ms / 1000;
  if (secs < 60) return `${secs.toFixed(1)}s`;
  return `${(secs / 60).toFixed(1)}m`;
}

function RunHistoryPanel({ jobId }: { jobId: string }) {
  const [runs, setRuns] = useState<CronRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRuns = useCallback(() => {
    setLoading(true);
    setError(null);
    getCronRuns(jobId, 20)
      .then(setRuns)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [jobId]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-theme-muted text-xs">
        <div className="theme-spinner animate-spin rounded-full h-4 w-4" />
        Loading run history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-status-error-soft)]">
            {t('cron.load_run_history_error')}: {error}
          </span>
          <button
            onClick={fetchRuns}
            className="text-theme-muted hover:text-theme-primary transition-colors duration-300"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="px-4 py-3 flex items-center justify-between">
        <span className="text-xs text-theme-faint">{t('cron.no_runs')}</span>
        <button
          onClick={fetchRuns}
          className="text-theme-muted hover:text-theme-primary transition-colors duration-300"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-theme-secondary">
          {t('cron.recent_runs')} ({runs.length})
        </span>
        <button
          onClick={fetchRuns}
          className="text-theme-muted hover:text-theme-primary transition-colors duration-300"
          title="Refresh runs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-1.5 max-h-60 overflow-y-auto">
        {runs.map((run) => (
          <div
            key={run.id}
            className="rounded-lg px-3 py-2 text-xs border"
            style={{ background: 'color-mix(in srgb, var(--color-accent-blue) 4%, var(--color-bg-card))', borderColor: 'color-mix(in srgb, var(--color-border-default) 75%, transparent)' }}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                {run.status === 'ok' ? (
                  <CheckCircle className="h-3.5 w-3.5 text-[#00e68a]" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-[#ff4466]" />
                )}
                <span className="text-theme-secondary capitalize">{run.status}</span>
              </div>
              <span className="text-theme-muted">
                {formatDuration(run.duration_ms)}
              </span>
            </div>
            <div className="flex items-center gap-3 text-theme-muted">
              <span>{formatDate(run.started_at)}</span>
            </div>
            {run.output && (
              <pre className="mt-1.5 rounded p-2 text-theme-secondary text-xs overflow-x-auto max-h-24 whitespace-pre-wrap break-words" style={{ background: 'var(--color-bg-input)' }}>
                {run.output}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Cron() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [settings, setSettings] = useState<CronSettings | null>(null);
  const [togglingCatchUp, setTogglingCatchUp] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSchedule, setFormSchedule] = useState('');
  const [formCommand, setFormCommand] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchJobs = () => {
    setLoading(true);
    getCronJobs()
      .then(setJobs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  const fetchSettings = () => {
    getCronSettings().then(setSettings).catch(() => {});
  };

  const toggleCatchUp = async () => {
    if (!settings) return;
    setTogglingCatchUp(true);
    try {
      const updated = await patchCronSettings({
        catch_up_on_startup: !settings.catch_up_on_startup,
      });
      setSettings(updated);
    } catch {
      // silently fail — user can retry
    } finally {
      setTogglingCatchUp(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    fetchSettings();
  }, []);

  const handleAdd = async () => {
    if (!formSchedule.trim() || !formCommand.trim()) {
      setFormError(t('cron.validation_error'));
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const job = await addCronJob({
        name: formName.trim() || undefined,
        schedule: formSchedule.trim(),
        command: formCommand.trim(),
      });
      setJobs((prev) => [...prev, job]);
      setShowForm(false);
      setFormName('');
      setFormSchedule('');
      setFormCommand('');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : t('cron.add_error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCronJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('cron.delete_error'));
    } finally {
      setConfirmDelete(null);
    }
  };

  const statusIcon = (status: string | null) => {
    if (!status) return null;
    switch (status.toLowerCase()) {
      case 'ok':
      case 'success':
        return <CheckCircle className="h-4 w-4 text-[#00e68a]" />;
      case 'error':
      case 'failed':
        return <XCircle className="h-4 w-4 text-[#ff4466]" />;
      default:
        return <AlertCircle className="h-4 w-4 text-[#ffaa00]" />;
    }
  };

  if (error) {
    return (
      <div className="p-6 animate-fade-in">
        <div className="rounded-xl p-4 text-[var(--color-status-error-soft)]" style={{ background: 'color-mix(in srgb, var(--color-status-error) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-status-error) 22%, transparent)' }}>
          {t('cron.load_error')}: {error}
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-[#0080ff]" />
          <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider">
            {t('cron.scheduled_tasks')} ({jobs.length})
          </h2>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-electric flex items-center gap-2 text-sm px-4 py-2"
        >
          <Plus className="h-4 w-4" />
          {t('cron.add_job')}
        </button>
      </div>

      {/* Catch-up toggle */}
      {settings && (
        <div className="glass-card px-4 py-3 flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-white">
              Catch up missed jobs on startup
            </span>
            <p className="text-xs text-[#556080] mt-0.5">
              Run all overdue jobs when ZeroClaw starts after downtime
            </p>
          </div>
          <button
            onClick={toggleCatchUp}
            disabled={togglingCatchUp}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none ${
              settings.catch_up_on_startup
                ? 'bg-[#0080ff]'
                : 'bg-[#1a1a3e]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform duration-300 ${
                settings.catch_up_on_startup
                  ? 'translate-x-6'
                  : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      )}

      {/* Add Job Form Modal */}
      {showForm && (
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50">
          <div className="glass-card p-6 w-full max-w-md mx-4 animate-fade-in-scale">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-theme-primary">{t('cron.add_modal_title')}</h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setFormError(null);
                }}
                className="text-theme-muted hover:text-theme-primary transition-colors duration-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl p-3 text-sm text-[var(--color-status-error-soft)] animate-fade-in" style={{ background: 'color-mix(in srgb, var(--color-status-error) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-status-error) 22%, transparent)' }}>
                {formError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-theme-secondary mb-1.5 uppercase tracking-wider">
                  {t('cron.name_optional')}
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Daily cleanup"
                  className="input-electric w-full px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-theme-secondary mb-1.5 uppercase tracking-wider">
                  {t('cron.schedule_required')} <span className="text-[var(--color-status-error)]">*</span>
                </label>
                <input
                  type="text"
                  value={formSchedule}
                  onChange={(e) => setFormSchedule(e.target.value)}
                  placeholder="e.g. 0 0 * * * (cron expression)"
                  className="input-electric w-full px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-theme-secondary mb-1.5 uppercase tracking-wider">
                  {t('cron.command_required')} <span className="text-[var(--color-status-error)]">*</span>
                </label>
                <input
                  type="text"
                  value={formCommand}
                  onChange={(e) => setFormCommand(e.target.value)}
                  placeholder="e.g. cleanup --older-than 7d"
                  className="input-electric w-full px-3 py-2.5 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowForm(false);
                  setFormError(null);
                }}
                className="px-4 py-2 text-sm font-medium text-theme-secondary hover:text-theme-primary border border-[var(--color-border-default)] rounded-xl hover:bg-[var(--color-accent-blue-soft)] transition-all duration-300"
              >
                {t('cron.cancel')}
              </button>
              <button
                onClick={handleAdd}
                disabled={submitting}
                className="btn-electric px-4 py-2 text-sm font-medium"
              >
                {submitting ? t('cron.adding') : t('cron.add_job')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Jobs Table */}
      {jobs.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Clock className="h-10 w-10 text-[var(--color-border-strong)] mx-auto mb-3" />
          <p className="text-theme-muted">{t('cron.empty')}</p>
        </div>
      ) : (
        <div className="glass-card overflow-x-auto">
          <table className="table-electric">
            <thead>
              <tr>
                <th className="text-left">{t('cron.id')}</th>
                <th className="text-left">{t('cron.name')}</th>
                <th className="text-left">{t('cron.command')}</th>
                <th className="text-left">{t('cron.next_run')}</th>
                <th className="text-left">{t('cron.last_status')}</th>
                <th className="text-left">{t('cron.enabled')}</th>
                <th className="text-right">{t('cron.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <React.Fragment key={job.id}>
                  <tr>
                    <td className="px-4 py-3 text-theme-muted font-mono text-xs">
                      <button
                        onClick={() =>
                          setExpandedJob((prev) =>
                            prev === job.id ? null : job.id,
                          )
                        }
                        className="flex items-center gap-1 text-theme-muted hover:text-theme-primary transition-colors duration-300"
                        title="Toggle run history"
                      >
                        {expandedJob === job.id ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                        {job.id.slice(0, 8)}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-theme-primary font-medium text-sm">
                      {job.name ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-theme-secondary font-mono text-xs max-w-[200px] truncate">
                      {job.command}
                    </td>
                    <td className="px-4 py-3 text-theme-muted text-xs">
                      {formatDate(job.next_run)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {statusIcon(job.last_status)}
                        <span className="text-theme-secondary text-xs capitalize">
                          {job.last_status ?? '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          job.enabled
                            ? 'text-[var(--color-status-success)] border-[color:color-mix(in_srgb,var(--color-status-success)_20%,transparent)]'
                            : 'text-theme-faint border-[var(--color-border-default)]'
                        }`}
                        style={{ background: job.enabled ? 'color-mix(in srgb, var(--color-status-success) 8%, transparent)' : 'color-mix(in srgb, var(--color-border-default) 38%, transparent)' }}
                      >
                        {job.enabled ? t('cron.enabled_status') : t('cron.disabled_status')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {confirmDelete === job.id ? (
                        <div className="flex items-center justify-end gap-2 animate-fade-in">
                          <span className="text-xs text-[var(--color-status-error)]">{t('cron.confirm_delete')}</span>
                          <button
                            onClick={() => handleDelete(job.id)}
                            className="text-[var(--color-status-error)] hover:text-[var(--color-status-error-soft)] text-xs font-medium"
                          >
                            {t('cron.yes')}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-theme-muted hover:text-theme-primary text-xs font-medium"
                          >
                            {t('cron.no')}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(job.id)}
                          className="text-theme-faint hover:text-[var(--color-status-error)] transition-all duration-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedJob === job.id && (
                    <tr style={{ background: 'color-mix(in srgb, var(--color-accent-blue) 6%, var(--color-bg-secondary))' }}>
                      <td colSpan={7}>
                        <RunHistoryPanel jobId={job.id} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
