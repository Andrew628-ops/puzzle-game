import { Plus, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ACHIEVEMENT_METRICS } from '../../../shared/catalog';
import { BadgeIcon, Modal, SectionTitle } from '../../components/UI';
import { useApp } from '../../context';
import { api } from '../../lib';
import type { AchievementDefinition } from '../../types';
import { DataState, useAdminData } from './shared';
export function AdminAchievements() {
  const state = useAdminData<(AchievementDefinition & { unlocked: number })[]>('/achievements');
  const [creating, setCreating] = useState(false);
  return (
    <>
      <div className="admin-toolbar">
        <SectionTitle
          title="Make progress worth celebrating"
          subtitle="Create badges with real, measurable requirements."
        />
        <button className="button primary" onClick={() => setCreating(true)}>
          <Plus size={16} />
          Create achievement
        </button>
      </div>
      <DataState {...state}>
        <div className="admin-badge-grid">
          {state.data?.map((badge) => (
            <article className="panel admin-badge" key={badge.id}>
              <span className="achievement-emblem">
                <BadgeIcon name={badge.icon} size={29} />
              </span>
              <h3>{badge.name}</h3>
              <p>{badge.description}</p>
              <div>
                <span>
                  {ACHIEVEMENT_METRICS.find((item) => item.id === badge.metric)?.label ||
                    'Puzzles completed'}
                </span>
                <strong>{badge.goal}</strong>
              </div>
              <small>{badge.unlocked} players have unlocked this badge</small>
            </article>
          ))}
        </div>
      </DataState>
      {creating && (
        <AchievementEditor
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            state.refresh();
          }}
        />
      )}
    </>
  );
}

export function AchievementEditor({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [icon, setIcon] = useState('trophy'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const { refreshCatalog, setToast } = useApp();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api('/admin/achievements', {
        method: 'POST',
        body: JSON.stringify({ ...data, icon, goal: Number(data.goal) }),
      });
      await refreshCatalog();
      setToast('A new milestone is ready for your players.');
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal onClose={onClose} label="Create achievement">
      <h2>A badge for a little breakthrough.</h2>
      <p>
        Existing progress counts toward the target. Eligible players unlock it when their profile
        refreshes.
      </p>
      <form className="auth-form" onSubmit={submit}>
        <label>
          Badge name
          <input
            className="field"
            name="name"
            required
            minLength={3}
            maxLength={36}
            placeholder="e.g. Getting into the groove"
          />
        </label>
        <label>
          Description
          <input
            className="field"
            name="description"
            required
            minLength={5}
            maxLength={160}
            placeholder="e.g. Complete 10 puzzles."
          />
        </label>
        <label>Badge icon</label>
        <div className="admin-icon-picker">
          {['footprints', 'zap', 'target', 'flame', 'brain', 'calendar', 'trophy', 'crown'].map(
            (name) => (
              <button
                type="button"
                key={name}
                className={icon === name ? 'selected' : ''}
                aria-label={`Choose ${name} badge`}
                onClick={() => setIcon(name)}
              >
                <BadgeIcon name={name} size={23} />
              </button>
            ),
          )}
        </div>
        <div className="admin-form-grid">
          <label>
            Requirement
            <select className="field" name="metric" aria-label="Requirement">
              {ACHIEVEMENT_METRICS.map((metric) => (
                <option key={metric.id} value={metric.id}>
                  {metric.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Target
            <input
              className="field"
              name="goal"
              type="number"
              min={1}
              max={10000}
              required
              defaultValue={10}
            />
          </label>
        </div>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full-width" disabled={busy}>
          {busy ? 'Creating…' : 'Create achievement'}
          <Sparkles size={16} />
        </button>
      </form>
    </Modal>
  );
}
