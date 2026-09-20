import { useCallback, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  LogOut,
  Pencil,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  Zap,
} from 'lucide-react';
import { useApp } from '../context';
import { Logo } from '../components/Art';
import { BadgeIcon, Modal, SectionTitle } from '../components/UI';
import { api, dateLabel, time } from '../lib';
import { DIFFICULTIES, getStreak } from '../../shared/game';
import type { Difficulty, Player } from '../types';
export function AuthDialog() {
  const { auth, setAuth, setPlayer, setToast, navigate } = useApp();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [visible, setVisible] = useState(false),
    [sent, setSent] = useState(false);
  const close = useCallback(() => setAuth(null), [setAuth]);
  if (!auth) return null;
  const register = auth === 'register',
    forgot = auth === 'forgot';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (register && data.password !== data.confirm) {
      setError('Your passwords don’t match. Try again.');
      return;
    }
    setBusy(true);
    try {
      if (forgot) {
        await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify(data) });
        setSent(true);
      } else {
        const player = await api<Player>(`/auth/${register ? 'register' : 'login'}`, {
          method: 'POST',
          body: JSON.stringify(data),
        });
        setPlayer(player);
        setAuth(null);
        setToast(
          register
            ? 'Welcome to PuzzleMind. Your next chapter starts here.'
            : 'Welcome back. Let’s make a little progress.',
        );
        navigate('dashboard');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      onClose={close}
      label={register ? 'Create account' : forgot ? 'Reset password' : 'Log in'}
    >
      <div className="auth-brand">
        <Logo />
        <span>PuzzleMind</span>
      </div>
      <h2>
        {sent
          ? 'Check your inbox.'
          : register
            ? 'Your next chapter starts here.'
            : forgot
              ? 'Let’s get you back in.'
              : 'Hello again, curious mind.'}
      </h2>
      <p>
        {sent
          ? 'If that email matches an account, you’ll receive a reset link. For local development, the link is in the server console.'
          : register
            ? 'Save your wins. Find your people. Keep growing.'
            : forgot
              ? 'Enter your account email and we’ll send a reset link.'
              : 'Your puzzles, progress, and little victories await.'}
      </p>
      {!sent && (
        <form className="auth-form" onSubmit={submit}>
          {register && (
            <label>
              Username
              <input
                className="field"
                name="username"
                placeholder="What should we call you?"
                required
                minLength={2}
                maxLength={24}
                autoComplete="username"
                pattern="[a-zA-Z0-9_ \-]+"
              />
            </label>
          )}
          <label>
            Email address
            <input
              className="field"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </label>
          {!forgot && (
            <label>
              Password
              <div className="password-field">
                <input
                  className="field"
                  name="password"
                  type={visible ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete={register ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  aria-label={visible ? 'Hide password' : 'Show password'}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
          )}
          {register && (
            <label>
              Confirm password
              <input
                className="field"
                name="confirm"
                type={visible ? 'text' : 'password'}
                required
                minLength={8}
                placeholder="One more time"
                autoComplete="new-password"
              />
            </label>
          )}
          {!forgot && !register && (
            <button
              type="button"
              className="text-button forgot-link"
              onClick={() => {
                setAuth('forgot');
                setError('');
              }}
            >
              Forgot password?
            </button>
          )}
          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}
          <button disabled={busy} className="button primary full-width" type="submit">
            {busy
              ? 'Just a moment…'
              : register
                ? 'Create my account'
                : forgot
                  ? 'Send reset link'
                  : 'Log in'}
            <ArrowRight size={17} />
          </button>
        </form>
      )}
      <div className="auth-switch">
        {register
          ? 'Already part of the puzzle?'
          : forgot
            ? 'Remember your password?'
            : 'New to PuzzleMind?'}{' '}
        <button
          className="text-button"
          onClick={() => {
            setAuth(register || forgot ? 'login' : 'register');
            setError('');
            setSent(false);
          }}
        >
          {register || forgot ? 'Log in' : 'Create an account'}
        </button>
      </div>
      <div className="auth-security">
        <ShieldCheck size={14} />
        Your progress, safely in your corner.
      </div>
    </Modal>
  );
}
export function ResetPassword() {
  const { navigate, setAuth } = useApp();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (data.password !== data.confirm) {
      setError('Your passwords don’t match.');
      return;
    }
    setBusy(true);
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          password: data.password,
          token: new URLSearchParams(location.hash.split('?')[1]).get('token'),
        }),
      });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="panel reset-page">
      <LockKeyhole size={35} />
      <h1>{done ? 'A fresh start.' : 'Choose a new password.'}</h1>
      <p>
        {done
          ? 'Your password has been updated. You can log in again.'
          : 'Use at least 8 characters to secure your account.'}
      </p>
      {done ? (
        <button
          className="button primary"
          onClick={() => {
            navigate('home');
            setAuth('login');
          }}
        >
          Back to log in <ArrowRight size={17} />
        </button>
      ) : (
        <form className="auth-form" onSubmit={submit}>
          <label>
            New password
            <input
              className="field"
              type="password"
              name="password"
              minLength={8}
              maxLength={128}
              required
              autoComplete="new-password"
            />
          </label>
          <label>
            Confirm password
            <input
              className="field"
              type="password"
              name="confirm"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </label>
          {error && <p className="error-message">{error}</p>}
          <button className="button primary" disabled={busy}>
            {busy ? 'Updating…' : 'Update password'}
          </button>
        </form>
      )}
    </div>
  );
}
export function Profile() {
  const {
    definitions,
    player,
    setPlayer,
    setAuth,
    history,
    level,
    xp,
    achievements,
    navigate,
    setToast,
  } = useApp();
  const [editing, setEditing] = useState(false),
    [avatar, setAvatar] = useState(player?.avatar || '🌱'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const updated = await api<Player>('/profile', {
        method: 'PUT',
        body: JSON.stringify({ ...data, avatar }),
      });
      setPlayer(updated);
      setEditing(false);
      setToast('Profile updated. Looking like you!');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const streak = getStreak(history);
  return (
    <>
      <div className="page-intro">
        <div className="eyebrow">
          <UserRound size={15} /> YOUR OWN LITTLE CORNER
        </div>
        <h1>A mind in the making.</h1>
        <p>Your story, one puzzle at a time.</p>
      </div>
      <section className="profile-hero panel">
        <span className="profile-avatar">{player?.avatar || '🌱'}</span>
        <div className="profile-identity">
          <span className="profile-level">
            <Zap size={13} />
            LEVEL {level.level} · CURIOUS MIND
          </span>
          <h2>{player?.username || 'Puzzle explorer'}</h2>
          <p>{player?.bio || 'Collecting little wins and big aha moments.'}</p>
          <span className="profile-joined">
            <CalendarDays size={13} />
            {player
              ? `Growing since ${dateLabel(player.created_at)}`
              : 'Playing as a guest · saved on this device'}
          </span>
        </div>
        <button
          className="button secondary"
          onClick={() => (player ? setEditing(true) : setAuth('register'))}
        >
          {player ? <Pencil size={15} /> : <UserRound size={15} />}{' '}
          {player ? 'Edit profile' : 'Create account'}
        </button>
      </section>
      <div className="profile-grid">
        <section className="panel profile-progress">
          <SectionTitle title="Your next chapter" />
          <div className="profile-xp">
            <strong>Level {level.level}</strong>
            <span>
              {xp - level.start} / {level.next - level.start} XP
            </span>
          </div>
          <div className="xp-track large-track">
            <span style={{ width: `${level.progress}%` }} />
          </div>
          <p>
            {level.next - xp} more XP to level {level.level + 1}. Every puzzle counts.
          </p>
          <button className="button primary" onClick={() => navigate('play')}>
            Keep growing <ArrowUpRight size={16} />
          </button>
        </section>
        <section className="panel profile-stats">
          <SectionTitle title="The good stuff" />
          <div>
            {[
              ['Puzzles completed', history.length],
              ['Total play time', time(history.reduce((n, g) => n + g.seconds, 0))],
              [
                'Average moves',
                history.length
                  ? Math.round(history.reduce((n, g) => n + g.moves, 0) / history.length)
                  : '—',
              ],
              [
                'Best completion',
                history.length ? time(Math.min(...history.map((g) => g.seconds))) : '—',
              ],
              [
                'Highest score',
                history.length ? Math.max(...history.map((g) => g.score)).toLocaleString() : '—',
              ],
              ['Current / longest streak', `${streak.current} / ${streak.longest} days`],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="panel profile-badges">
        <SectionTitle
          title="Your badge collection"
          action="All achievements"
          onClick={() => navigate('achievements')}
        />
        <div className="profile-badge-row">
          {definitions.map((a) => (
            <div
              className={achievements.some((u) => u.id === a.id) ? 'earned' : ''}
              key={a.id}
              title={`${a.name}: ${a.description}`}
            >
              <BadgeIcon name={a.icon} size={26} />
              <span>{a.name}</span>
            </div>
          ))}
        </div>
      </section>
      {editing && (
        <Modal onClose={() => setEditing(false)} label="Edit your profile">
          <h2>Make yourself at home.</h2>
          <p>A few details that make this corner yours.</p>
          <form className="auth-form" onSubmit={save}>
            <label>Choose your avatar</label>
            <div className="avatar-picker">
              {['🌱', '🧠', '🦊', '🐼', '🚀', '🪴', '😎', '🐱'].map((a) => (
                <button
                  type="button"
                  className={avatar === a ? 'selected' : ''}
                  key={a}
                  aria-label={`Choose ${a} avatar`}
                  onClick={() => setAvatar(a)}
                >
                  {a}
                </button>
              ))}
            </div>
            <label>
              Username
              <input
                className="field"
                name="username"
                defaultValue={player?.username}
                required
                minLength={2}
                maxLength={24}
              />
            </label>
            <label>
              A little about you
              <textarea
                className="field"
                name="bio"
                maxLength={240}
                defaultValue={player?.bio}
                placeholder="What keeps your mind curious?"
                rows={3}
              />
            </label>
            {error && <p className="error-message">{error}</p>}
            <button disabled={busy} className="button primary full-width">
              {busy ? 'Saving…' : 'Save profile'}
              <Check size={17} />
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function Settings() {
  const {
    preferences,
    updatePreferences,
    player,
    logout,
    setAuth,
    level,
    setToast,
    setPlayer,
    navigate,
  } = useApp();
  const [dialog, setDialog] = useState<'password' | 'delete' | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function accountAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (dialog === 'delete') {
        await api('/profile', { method: 'DELETE', body: JSON.stringify(body) });
        setPlayer(null);
        setDialog(null);
        navigate('home');
        setToast('Your account and its saved data have been deleted.');
      } else {
        if (body.password !== body.confirm) throw new Error('Your new passwords don’t match.');
        await api('/profile/password', { method: 'POST', body: JSON.stringify(body) });
        setDialog(null);
        setToast('Password updated successfully.');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-intro">
        <div className="eyebrow">
          <Sparkles size={15} /> MAKE IT YOURS
        </div>
        <h1>Your game. Your rhythm.</h1>
        <p>Set the mood for your next aha moment.</p>
      </div>
      <div className="settings-layout">
        <section className="panel settings-panel">
          <h2>The way you play</h2>
          {(
            [
              {
                key: 'sound',
                title: 'Sound effects',
                description: 'A little feedback for every satisfying move.',
              },
              {
                key: 'music',
                title: 'Background ambience',
                description: 'A soft, steady tone to help you find your focus.',
              },
              { key: 'dark', title: 'Dark mode', description: 'Keep things easy on your eyes.' },
              {
                key: 'animations',
                title: 'Animations',
                description: 'A little movement, a little personality.',
              },
              {
                key: 'notifications',
                title: 'Achievement notifications',
                description: 'Celebrate your milestones as they happen.',
              },
            ] as const
          ).map(({ key, title, description }) => (
            <div className="setting-row" key={key}>
              <div>
                <strong>{title}</strong>
                <p>{description}</p>
              </div>
              <button
                className={`toggle ${preferences[key] ? 'on' : ''}`}
                role="switch"
                aria-checked={preferences[key]}
                aria-label={title}
                onClick={() => updatePreferences({ [key]: !preferences[key] })}
              >
                <span />
              </button>
            </div>
          ))}
          <div className="setting-row">
            <div>
              <strong>Your starting difficulty</strong>
              <p>Choose where new puzzles begin.</p>
            </div>
            <select
              className="field"
              aria-label="Default difficulty"
              value={preferences.difficulty}
              onChange={(e) => updatePreferences({ difficulty: e.target.value as Difficulty })}
            >
              {Object.entries(DIFFICULTIES).map(([key, d]) => (
                <option key={key} value={key}>
                  {d.label} · {d.size} × {d.size}
                </option>
              ))}
            </select>
          </div>
        </section>
        <section className="panel settings-panel theme-panel">
          <h2>A change of scenery</h2>
          <p>A little color can change your whole perspective.</p>
          <div className="theme-grid">
            {[
              { id: 'classic', name: 'Classic', level: 1, color: '#c3f578' },
              { id: 'ocean', name: 'Ocean', level: 2, color: '#82cbe7' },
              { id: 'neon', name: 'Neon', level: 3, color: '#ed8fde' },
              { id: 'forest', name: 'Forest', level: 4, color: '#6fbd90' },
              { id: 'space', name: 'Space', level: 5, color: '#b69de9' },
              { id: 'gold', name: 'Gold', level: 8, color: '#eac376' },
            ].map((theme) => (
              <button
                className={`theme-option ${preferences.theme === theme.id ? 'selected' : ''}`}
                key={theme.id}
                disabled={level.level < theme.level}
                onClick={() => updatePreferences({ theme: theme.id })}
              >
                <span style={{ background: theme.color }}>
                  {level.level < theme.level ? (
                    <LockKeyhole size={17} />
                  ) : preferences.theme === theme.id ? (
                    <Check size={19} />
                  ) : (
                    <Sparkles size={19} />
                  )}
                </span>
                <strong>{theme.name}</strong>
                <small>
                  {level.level < theme.level
                    ? `Level ${theme.level}`
                    : preferences.theme === theme.id
                      ? 'Selected'
                      : 'Unlocked'}
                </small>
              </button>
            ))}
          </div>
        </section>
      </div>
      <section className="panel settings-panel account-settings">
        <h2>Your account</h2>
        {player ? (
          <>
            <div className="setting-row">
              <div>
                <strong>{player.email}</strong>
                <p>Keep your little corner secure.</p>
              </div>
              <button
                className="button secondary"
                onClick={() => {
                  setDialog('password');
                  setError('');
                }}
              >
                <LockKeyhole size={15} />
                Change password
              </button>
            </div>
            <div className="setting-row">
              <div>
                <strong>Take a break</strong>
                <p>Your account progress will be here when you get back.</p>
              </div>
              <button className="button secondary" onClick={() => void logout()}>
                <LogOut size={15} />
                Log out
              </button>
            </div>
            <div className="setting-row">
              <div>
                <strong>Delete account</strong>
                <p>Permanently delete your account and all saved progress.</p>
              </div>
              <button
                className="button danger-button"
                onClick={() => {
                  setDialog('delete');
                  setError('');
                }}
              >
                <Trash2 size={15} />
                Delete account
              </button>
            </div>
          </>
        ) : (
          <div className="setting-row">
            <div>
              <strong>Make your progress permanent.</strong>
              <p>Create an account to save your next wins and join the leaderboard.</p>
            </div>
            <button className="button primary" onClick={() => setAuth('register')}>
              Create account <ArrowUpRight size={15} />
            </button>
          </div>
        )}
      </section>
      {dialog && (
        <Modal
          onClose={() => setDialog(null)}
          label={dialog === 'delete' ? 'Delete account' : 'Change password'}
        >
          <h2>{dialog === 'delete' ? 'Say goodbye to your account?' : 'A fresh password.'}</h2>
          <p>
            {dialog === 'delete'
              ? 'This permanently deletes your profile, game history, and achievements. Enter your password to confirm.'
              : 'Enter your current password and choose a new one with at least 8 characters.'}
          </p>
          <form className="auth-form" onSubmit={accountAction}>
            <label>
              Current password
              <input
                className="field"
                name={dialog === 'delete' ? 'password' : 'currentPassword'}
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            {dialog === 'password' && (
              <>
                <label>
                  New password
                  <input
                    className="field"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    required
                  />
                </label>
                <label>
                  Confirm new password
                  <input
                    className="field"
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>
              </>
            )}
            {error && <p className="error-message">{error}</p>}
            <button
              className={`button full-width ${dialog === 'delete' ? 'danger-button' : 'primary'}`}
              disabled={busy}
            >
              {busy
                ? 'Working…'
                : dialog === 'delete'
                  ? 'Permanently delete account'
                  : 'Update password'}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
