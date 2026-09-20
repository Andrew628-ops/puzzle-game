import { ChevronRight, Search, ShieldCheck, ShieldOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { EmptyState, Modal, SectionTitle } from '../../components/UI';
import { useApp } from '../../context';
import { api, dateLabel } from '../../lib';
import { DataState, Pagination, useAdminData, type PageData } from './shared';
export interface AdminUser {
  id: string;
  username: string;
  email: string;
  avatar: string;
  role: string;
  suspended: number;
  suspension_reason: string;
  created_at: string;
  solved: number;
  score: number;
  level: number;
}

export function AdminUsers() {
  const [query, setQuery] = useState(''),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<AdminUser | null>(null);
  const state = useAdminData<PageData<AdminUser>>(
    `/users?q=${encodeURIComponent(search)}&page=${page}`,
  );
  return (
    <>
      <div className="admin-toolbar">
        <SectionTitle
          title="The minds behind the moves"
          subtitle="Manage accounts and keep your community welcoming."
        />
        <form
          className="admin-search"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query);
            setPage(1);
          }}
        >
          <input
            className="field"
            placeholder="Find a player or email…"
            aria-label="Search players"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="button secondary" aria-label="Search player accounts">
            <Search size={16} />
          </button>
        </form>
      </div>
      <section className="panel admin-table-panel">
        <DataState {...state}>
          {state.data && (
            <>
              <div className="admin-count">
                {state.data.total} {state.data.total === 1 ? 'player' : 'players'}
              </div>
              {state.data.rows.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th>Progress</th>
                        <th>Joined</th>
                        <th>Status</th>
                        <th>Account</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.data.rows.map((user) => (
                        <tr key={user.id}>
                          <td>
                            <div className="admin-player-cell">
                              <span className="avatar">{user.avatar}</span>
                              <div>
                                <strong>{user.username}</strong>
                                <small>{user.email}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <strong>Level {user.level}</strong>
                            <small className="table-subtext">
                              {user.solved} solved · {user.score.toLocaleString()} pts
                            </small>
                          </td>
                          <td>{dateLabel(user.created_at)}</td>
                          <td>
                            <span className={`admin-status ${user.suspended ? 'warn' : 'live'}`}>
                              {user.suspended ? 'Suspended' : 'Active'}
                            </span>
                          </td>
                          <td>
                            {user.role === 'admin' ? (
                              <span className="admin-protected">
                                <ShieldCheck size={14} />
                                Administrator
                              </span>
                            ) : (
                              <button className="text-button" onClick={() => setSelected(user)}>
                                {user.suspended ? 'Restore account' : 'Suspend account'}
                                <ChevronRight size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={<Search size={28} />}
                  title="No players found."
                  description="Try a different username or email address."
                />
              )}
              <Pagination page={page} pages={state.data.pages} onChange={setPage} />
            </>
          )}
        </DataState>
      </section>
      {selected && (
        <PlayerStatusDialog
          user={selected}
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

export function PlayerStatusDialog({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const { setToast } = useApp();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/admin/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          suspended: !user.suspended,
          reason: new FormData(e.currentTarget).get('reason') || '',
        }),
      });
      setToast(`${user.username}’s account has been ${user.suspended ? 'restored' : 'suspended'}.`);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      onClose={onClose}
      label={user.suspended ? 'Restore player account' : 'Suspend player account'}
    >
      <span className="modal-feature-icon">
        {user.suspended ? <ShieldCheck size={30} /> : <ShieldOff size={30} />}
      </span>
      <h2>{user.suspended ? 'Welcome them back.' : 'Pause this player’s account?'}</h2>
      <p>
        {user.suspended
          ? `${user.username} will be able to log in again. Their saved progress will be preserved.`
          : `${user.username} will be signed out immediately and removed from public rankings. Their saved games stay intact.`}
      </p>
      {user.suspended && user.suspension_reason && (
        <div className="admin-context-note">Previous reason: {user.suspension_reason}</div>
      )}
      <form className="auth-form" onSubmit={submit}>
        {!user.suspended && (
          <label>
            Reason
            <textarea
              className="field"
              name="reason"
              required
              minLength={5}
              maxLength={300}
              rows={3}
              placeholder="Give the moderation team some context."
            />
          </label>
        )}
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <button
          disabled={busy}
          className={`button full-width ${user.suspended ? 'primary' : 'danger-button'}`}
        >
          {busy ? 'Saving…' : user.suspended ? 'Restore account' : 'Suspend account'}
        </button>
      </form>
    </Modal>
  );
}
