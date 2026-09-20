import { Check, Gamepad2, Pencil, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Modal, SectionTitle } from '../../components/UI';
import { useApp } from '../../context';
import { api } from '../../lib';
import type { GameDefinition } from '../../types';
import { DataState, useAdminData } from './shared';
export function AdminGames() {
  const state = useAdminData<GameDefinition[]>('/games');
  const [editing, setEditing] = useState<GameDefinition | 'new' | null>(null);
  return (
    <>
      <div className="admin-toolbar">
        <SectionTitle
          title="A library for curious minds"
          subtitle="Keep game cards fresh and introduce what’s coming next."
        />
        <button className="button primary" onClick={() => setEditing('new')}>
          <Plus size={16} />
          Add game mode
        </button>
      </div>
      <section className="panel admin-table-panel">
        <DataState {...state}>
          {state.data && (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Game</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.map((game) => (
                    <tr key={game.id}>
                      <td>
                        <strong>{game.name}</strong>
                        <small className="table-subtext">{game.description}</small>
                      </td>
                      <td>{game.tag}</td>
                      <td>
                        <span className={`admin-status ${game.available ? 'live' : ''}`}>
                          {game.available ? 'Playable' : 'Coming Soon'}
                        </span>
                      </td>
                      <td>
                        <button className="text-button" onClick={() => setEditing(game)}>
                          <Pencil size={14} />
                          Edit listing
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataState>
      </section>
      <div className="library-note">
        <Gamepad2 size={17} />
        <p>New listings appear as Coming Soon until a playable game engine is implemented.</p>
      </div>
      {editing && (
        <GameEditor
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            state.refresh();
          }}
        />
      )}
    </>
  );
}

export function GameEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial?: GameDefinition;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [color, setColor] = useState(initial?.color || 'purple'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const { refreshCatalog, setToast } = useApp();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api(`/admin/games${initial ? `/${initial.id}` : ''}`, {
        method: initial ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...values,
          id: initial?.id || values.id,
          color,
          available: initial?.available || false,
        }),
      });
      await refreshCatalog();
      setToast('The game library has been updated.');
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal onClose={onClose} label={initial ? 'Edit game listing' : 'Add game mode'}>
      <h2>{initial ? 'Give this game a fresh look.' : 'Make room for the next challenge.'}</h2>
      <p>
        {initial
          ? 'Update the name and description players see in the game library.'
          : 'Add a Coming Soon card. A new listing does not create a playable game engine.'}
      </p>
      <form className="auth-form" onSubmit={submit}>
        <label>
          Game name
          <input
            className="field"
            name="name"
            required
            minLength={3}
            maxLength={36}
            defaultValue={initial?.name}
          />
        </label>
        {!initial && (
          <label>
            Game slug
            <input
              className="field"
              name="id"
              required
              pattern="[a-z][a-z0-9\-]+"
              minLength={2}
              maxLength={40}
              placeholder="e.g. color-maze"
            />
          </label>
        )}
        <label>
          Description
          <textarea
            className="field"
            name="description"
            required
            minLength={5}
            maxLength={100}
            rows={2}
            defaultValue={initial?.description}
          />
        </label>
        <label>
          Category
          <input
            className="field"
            name="tag"
            minLength={2}
            maxLength={14}
            required
            placeholder="e.g. LOGIC"
            defaultValue={initial?.tag}
          />
        </label>
        <label>Card color</label>
        <div className="admin-color-picker">
          {['green', 'purple', 'orange', 'blue', 'pink', 'teal'].map((value) => (
            <button
              type="button"
              className={`${value} ${color === value ? 'selected' : ''}`}
              key={value}
              aria-label={`Choose ${value} card`}
              onClick={() => setColor(value)}
            >
              {color === value ? <Check size={18} /> : null}
            </button>
          ))}
        </div>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full-width" disabled={busy}>
          {busy ? 'Saving…' : initial ? 'Save listing' : 'Add Coming Soon game'}
          <Check size={16} />
        </button>
      </form>
    </Modal>
  );
}
