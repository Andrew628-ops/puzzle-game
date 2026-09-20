import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, HelpCircle, LoaderCircle, MessageSquare, Send } from 'lucide-react';
import { useApp } from '../context';
import { EmptyState, SectionTitle } from '../components/UI';
import { api, dateLabel } from '../lib';
import type { PlayerReport } from '../types';
export function SupportPage() {
  const { player, loaded, setAuth } = useApp();
  if (!loaded)
    return (
      <div className="admin-loading">
        <LoaderCircle className="spinner" />
        Loading your account…
      </div>
    );
  return (
    <>
      <div className="page-intro">
        <div className="eyebrow">
          <HelpCircle size={15} />
          WE’RE HERE FOR THE LITTLE HICCUPS
        </div>
        <h1>A little help, a better place to play.</h1>
        <p>Found a bug, have an idea, or need to flag a problem? We’re listening.</p>
      </div>
      {player ? (
        <PlayerSupport />
      ) : (
        <section className="panel">
          <EmptyState
            icon={<MessageSquare size={32} />}
            title="Let’s keep the conversation in your corner."
            description="Log in to send a report and follow the team’s replies from your account."
            action="Log in to get help"
            onClick={() => setAuth('login')}
          />
        </section>
      )}
    </>
  );
}
function PlayerSupport() {
  const [reports, setReports] = useState<PlayerReport[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [loadError, setLoadError] = useState('');
  const { setToast } = useApp();
  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setReports(await api<PlayerReport[]>('/reports'));
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    setError('');
    setBusy(true);
    try {
      const report = await api<PlayerReport>('/reports', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setReports((previous) => [report, ...previous]);
      form.reset();
      setToast('Your report is in. Follow updates in Help & feedback.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="support-grid">
      <section className="panel">
        <SectionTitle
          title="What’s on your mind?"
          subtitle="A clear description helps us get you an answer."
        />
        <form className="auth-form" onSubmit={submit}>
          <label>
            What kind of note is this?
            <select className="field" name="category" aria-label="Report category">
              <option value="bug">Something isn’t working</option>
              <option value="feedback">An idea or feedback</option>
              <option value="player">A problem with another player</option>
            </select>
          </label>
          <label>
            Subject
            <input
              className="field"
              name="subject"
              required
              minLength={3}
              maxLength={100}
              placeholder="A short description of the issue"
            />
          </label>
          <label>
            Tell us a little more
            <textarea
              className="field"
              name="body"
              required
              minLength={10}
              maxLength={2000}
              rows={6}
              placeholder="What happened? What did you expect? Include the game and your device if that helps."
            />
          </label>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            <Send size={16} />
            {busy ? 'Sending…' : 'Send report'}
          </button>
          <p className="form-helper">
            Please leave passwords and other private account details out of your report.
          </p>
        </form>
      </section>
      <section className="panel">
        <SectionTitle
          title="Your conversations"
          subtitle="Updates from the PuzzleMind team appear here."
          action="Refresh"
          onClick={() => void refresh()}
        />
        {loadError ? (
          <div className="error-message" role="alert">
            {loadError}
          </div>
        ) : loading ? (
          <div className="admin-loading">
            <LoaderCircle className="spinner" size={22} />
            Loading your reports…
          </div>
        ) : reports.length ? (
          <div className="support-report-list">
            {reports.map((report) => (
              <article key={report.id}>
                <div>
                  <span className={`admin-status ${report.status === 'resolved' ? 'live' : ''}`}>
                    {report.status === 'resolved' ? 'Resolved' : 'With the team'}
                  </span>
                  <small>{dateLabel(report.created_at)}</small>
                </div>
                <h3>{report.subject}</h3>
                <p className="preserve-lines">{report.body}</p>
                {report.response && (
                  <div className="support-reply">
                    <span>
                      <MessageSquare size={13} />
                      PuzzleMind team
                    </span>
                    <p className="preserve-lines">{report.response}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<CheckCircle2 size={29} />}
            title="A fresh conversation starts here."
            description="Once you send a report, you can follow its status and read replies here."
          />
        )}
      </section>
    </div>
  );
}
