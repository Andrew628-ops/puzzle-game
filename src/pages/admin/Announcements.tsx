import { Check, Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { EmptyState, Modal, SectionTitle } from '../../components/UI';
import { useApp } from '../../context';
import { api, dateLabel } from '../../lib';
import type { Announcement } from '../../types';
import { DataState, RemoveDialog, useAdminData } from './shared';
export function AdminAnnouncements() {
  const state = useAdminData<Announcement[]>('/announcements');
  const [editing, setEditing] = useState<Announcement | 'new' | null>(null),
    [removing, setRemoving] = useState<Announcement | null>(null);
  return (
    <>
      <div className="admin-toolbar">
        <SectionTitle
          title="A note to your curious minds"
          subtitle="Draft, publish, and manage news for the community."
        />
        <button className="button primary" onClick={() => setEditing('new')}>
          <Plus size={16} />
          Write announcement
        </button>
      </div>
      <DataState {...state}>
        {state.data?.length ? (
          <div className="admin-announcement-grid">
            {state.data.map((item) => (
              <article className="panel admin-announcement" key={item.id}>
                <div>
                  <span className={`admin-status ${item.published ? 'live' : ''}`}>
                    {item.published ? 'Published' : 'Draft'}
                  </span>
                  <span>{dateLabel(item.updated_at)}</span>
                </div>
                <h3>{item.title}</h3>
                <p className="preserve-lines">{item.body}</p>
                <div className="admin-announcement-actions">
                  <button className="text-button" onClick={() => setEditing(item)}>
                    <Pencil size={14} />
                    Edit announcement
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Delete announcement ${item.title}`}
                    onClick={() => setRemoving(item)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <section className="panel">
            <EmptyState
              icon={<Megaphone size={30} />}
              title="What’s new in your corner?"
              description="Published announcements appear on the overview and in the notification menu. Drafts stay here until you’re ready."
            />
          </section>
        )}
      </DataState>
      {editing && (
        <AnnouncementEditor
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            state.refresh();
          }}
        />
      )}
      {removing && (
        <RemoveDialog
          label="Delete announcement"
          title={`Delete “${removing.title}”?`}
          description="This removes the announcement from the studio and all player screens."
          path={`/admin/announcements/${removing.id}`}
          onClose={() => setRemoving(null)}
          onSaved={() => {
            setRemoving(null);
            state.refresh();
          }}
        />
      )}
    </>
  );
}

export function AnnouncementEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Announcement;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [published, setPublished] = useState(!!initial?.published),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const { refreshCatalog, setToast } = useApp();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api(`/admin/announcements${initial ? `/${initial.id}` : ''}`, {
        method: initial ? 'PUT' : 'POST',
        body: JSON.stringify({ ...data, published }),
      });
      await refreshCatalog();
      setToast(
        published
          ? 'Your announcement is now visible to players.'
          : 'Draft saved. Publish it when you’re ready.',
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal onClose={onClose} label={initial ? 'Edit announcement' : 'Write announcement'}>
      <span className="modal-feature-icon">
        <Megaphone size={30} />
      </span>
      <h2>A little news worth sharing.</h2>
      <p>Keep it friendly, useful, and easy to read.</p>
      <form className="auth-form" onSubmit={submit}>
        <label>
          Title
          <input
            className="field"
            name="title"
            required
            minLength={3}
            maxLength={80}
            defaultValue={initial?.title}
            placeholder="What’s the good news?"
          />
        </label>
        <label>
          Announcement
          <textarea
            className="field"
            name="body"
            rows={5}
            required
            minLength={5}
            maxLength={1000}
            defaultValue={initial?.body}
            placeholder="Tell your players what’s new."
          />
        </label>
        <label className="admin-publish-option">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          <span>Publish to the overview and notifications</span>
        </label>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full-width" disabled={busy}>
          {busy ? 'Saving…' : published ? 'Publish announcement' : 'Save draft'}
          <Check size={16} />
        </button>
      </form>
    </Modal>
  );
}
