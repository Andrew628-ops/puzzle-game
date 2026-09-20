import {
  CalendarDays,
  Check,
  CheckCircle2,
  Eye,
  LockKeyhole,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { DIFFICULTIES } from '../../../shared/game';
import { EmptyState, Modal, SectionTitle } from '../../components/UI';
import { useApp } from '../../context';
import { api, today } from '../../lib';
import type { Difficulty } from '../../types';
import { DataState, RemoveDialog, useAdminData } from './shared';
export interface ScheduledPuzzle {
  date: string;
  difficulty: Difficulty;
  board: number[];
  seed: string;
  completions: number;
  locked: boolean;
}

export function AdminDaily() {
  const state = useAdminData<ScheduledPuzzle[]>('/daily');
  const [editing, setEditing] = useState<ScheduledPuzzle | 'new' | null>(null),
    [removing, setRemoving] = useState<ScheduledPuzzle | null>(null);
  return (
    <>
      <div className="admin-toolbar">
        <SectionTitle
          title="A fresh challenge, every day"
          subtitle="Schedule future puzzles. Today’s puzzle stays the same for everyone."
        />
        <button className="button primary" onClick={() => setEditing('new')}>
          <Plus size={16} />
          Schedule puzzle
        </button>
      </div>
      <section className="panel admin-table-panel">
        <DataState {...state}>
          {state.data?.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>UTC date</th>
                    <th>Difficulty</th>
                    <th>Completions</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.map((puzzle) => (
                    <tr key={puzzle.date}>
                      <td>
                        <strong>{puzzle.date}</strong>
                      </td>
                      <td>
                        <span className={`difficulty-label ${puzzle.difficulty}`}>
                          {puzzle.difficulty}
                        </span>
                      </td>
                      <td>{puzzle.completions}</td>
                      <td>
                        <span className={`admin-status ${puzzle.locked ? '' : 'live'}`}>
                          {puzzle.date === today()
                            ? 'Today'
                            : puzzle.locked
                              ? 'Past puzzle'
                              : 'Scheduled'}
                        </span>
                      </td>
                      <td>
                        {puzzle.locked ? (
                          <span className="admin-protected">
                            <LockKeyhole size={13} />
                            Locked
                          </span>
                        ) : (
                          <div className="admin-row-actions">
                            <button
                              className="icon-button"
                              aria-label={`Edit puzzle ${puzzle.date}`}
                              onClick={() => setEditing(puzzle)}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={`Remove schedule ${puzzle.date}`}
                              onClick={() => setRemoving(puzzle)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={<CalendarDays size={28} />}
              title="Make tomorrow a little more interesting."
              description="On days without a schedule, PuzzleMind automatically creates a shared Medium puzzle."
            />
          )}
        </DataState>
      </section>
      <div className="library-note">
        <ShieldCheck size={17} />
        <p>Every preview is solvable. Dates follow UTC; current and past puzzles are locked.</p>
      </div>
      {editing && (
        <DailyEditor
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
          label="Remove scheduled puzzle"
          title={`Remove the ${removing.date} schedule?`}
          description="An automatic Medium puzzle will take its place. This only changes a future challenge."
          path={`/admin/daily/${removing.date}`}
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

export function DailyEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial?: ScheduledPuzzle;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(
      initial?.date || new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    ),
    [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty || 'medium'),
    [seed, setSeed] = useState(initial?.seed || ''),
    [preview, setPreview] = useState<{ board: number[] } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const { setToast, refreshCatalog } = useApp();
  async function previewPuzzle() {
    setBusy(true);
    setError('');
    try {
      setPreview(
        await api('/admin/daily/preview', {
          method: 'POST',
          body: JSON.stringify({ date, difficulty, seed }),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!preview) return;
    setBusy(true);
    setError('');
    try {
      await api('/admin/daily', {
        method: 'PUT',
        body: JSON.stringify({ date, difficulty, seed }),
      });
      await refreshCatalog();
      setToast(`The ${date} daily puzzle is scheduled.`);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal onClose={onClose} label="Schedule a daily puzzle">
      <span className="modal-feature-icon">
        <CalendarDays size={29} />
      </span>
      <h2>A little challenge for tomorrow.</h2>
      <p>Choose a date and difficulty, then preview the board before scheduling it.</p>
      <form className="auth-form" onSubmit={save}>
        <div className="admin-form-grid">
          <label>
            UTC date
            <input
              className="field"
              type="date"
              value={date}
              required
              min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
              max={new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)}
              disabled={busy}
              onChange={(e) => {
                setDate(e.target.value);
                setPreview(null);
              }}
            />
          </label>
          <label>
            Difficulty
            <select
              aria-label="Difficulty"
              className="field"
              value={difficulty}
              disabled={busy}
              onChange={(e) => {
                setDifficulty(e.target.value as Difficulty);
                setPreview(null);
              }}
            >
              {Object.entries(DIFFICULTIES).map(([id, config]) => (
                <option key={id} value={id}>
                  {config.label} · {config.size} × {config.size}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Puzzle seed <span className="optional-label">Optional · the date is used by default</span>
          <input
            className="field"
            value={seed}
            maxLength={80}
            disabled={busy}
            placeholder="e.g. autumn-brainwave"
            onChange={(e) => {
              setSeed(e.target.value);
              setPreview(null);
            }}
          />
        </label>
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={() => void previewPuzzle()}
        >
          <Eye size={16} />
          {busy ? 'Working…' : 'Preview puzzle'}
        </button>
        {preview && (
          <div className="admin-puzzle-preview">
            <div style={{ gridTemplateColumns: `repeat(${DIFFICULTIES[difficulty].size},1fr)` }}>
              {preview.board.map((number) => (
                <span key={number} className={!number ? 'empty' : ''}>
                  {number || '✳'}
                </span>
              ))}
            </div>
            <small>
              <CheckCircle2 size={13} />
              Solvable · every player receives this board
            </small>
          </div>
        )}
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <button disabled={busy || !preview} className="button primary full-width">
          <Check size={16} />
          {busy ? 'Saving…' : 'Save schedule'}
        </button>
      </form>
    </Modal>
  );
}
