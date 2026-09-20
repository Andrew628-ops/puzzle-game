import { Check, CheckCircle2, ChevronRight, MessageSquare } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { EmptyState, Modal, SectionTitle } from '../../components/UI';
import { useApp } from '../../context';
import { api, dateLabel } from '../../lib';
import type { PlayerReport } from '../../types';
import { DataState, Pagination, useAdminData, type PageData } from './shared';
export function AdminReports() {
  const [status, setStatus] = useState('open'),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<PlayerReport | null>(null);
  const state = useAdminData<PageData<PlayerReport>>(`/reports?status=${status}&page=${page}`);
  return (
    <>
      <div className="admin-toolbar">
        <SectionTitle
          title="A little listening goes a long way"
          subtitle="Read player feedback and help with the rough edges."
        />
        <div className="segmented-control">
          {['open', 'resolved'].map((value) => (
            <button
              key={value}
              className={status === value ? 'active' : ''}
              onClick={() => {
                setStatus(value);
                setPage(1);
              }}
            >
              {value === 'open' ? 'Open reports' : 'Resolved'}
            </button>
          ))}
        </div>
      </div>
      <section className="panel admin-table-panel">
        <DataState {...state}>
          {state.data && (
            <>
              {state.data.rows.length ? (
                <div className="admin-report-list">
                  {state.data.rows.map((report) => (
                    <button key={report.id} onClick={() => setSelected(report)}>
                      <span className="admin-report-icon">
                        <MessageSquare size={20} />
                      </span>
                      <span>
                        <strong>{report.subject}</strong>
                        <small>
                          {report.username || 'Deleted account'} · {report.category} ·{' '}
                          {dateLabel(report.created_at)}
                        </small>
                      </span>
                      <ChevronRight size={17} />
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<CheckCircle2 size={29} />}
                  title={status === 'open' ? 'All caught up.' : 'No resolved reports yet.'}
                  description={
                    status === 'open'
                      ? 'New player reports will appear here. Thanks for keeping this a welcoming place.'
                      : 'Resolved reports stay here so you can follow up or reopen them.'
                  }
                />
              )}
              <Pagination page={page} pages={state.data.pages} onChange={setPage} />
            </>
          )}
        </DataState>
      </section>
      {selected && (
        <ReportEditor
          report={selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            state.refresh();
          }}
        />
      )}
    </>
  );
}

export function ReportEditor({
  report,
  onClose,
  onSaved,
}: {
  report: PlayerReport;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState(report.status),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const { setToast } = useApp();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/admin/reports/${report.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, response: new FormData(e.currentTarget).get('response') }),
      });
      setToast('Report updated. The player can see your reply in Help & feedback.');
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal onClose={onClose} label="Review player report">
      <span className="eyebrow">
        {report.category} · {report.username || 'Deleted account'}
      </span>
      <h2>{report.subject}</h2>
      <div className="admin-context-note preserve-lines">{report.body}</div>
      <form className="auth-form" onSubmit={submit}>
        <label>
          Reply to the player
          <textarea
            className="field"
            name="response"
            rows={4}
            maxLength={1000}
            defaultValue={report.response}
            placeholder="Let them know what you found or how you can help."
          />
        </label>
        <label>
          Status
          <select
            aria-label="Status"
            className="field"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'open' | 'resolved')}
          >
            <option value="open">Open · needs attention</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full-width" disabled={busy}>
          {busy ? 'Saving…' : 'Save report update'}
          <Check size={16} />
        </button>
      </form>
    </Modal>
  );
}
