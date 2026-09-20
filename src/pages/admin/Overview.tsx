import { CalendarDays, Clock3, MessageSquare, Trophy, Users } from 'lucide-react';
import { DIFFICULTIES } from '../../../shared/game';
import { EmptyState, SectionTitle } from '../../components/UI';
import { time } from '../../lib';
import type { Difficulty, Leader } from '../../types';
import { DataState, useAdminData } from './shared';
export interface Overview {
  users: { total: number; active: number; suspended: number };
  stats: {
    completions: number;
    points: number;
    seconds: number;
    averageMoves: number;
    players: number;
  };
  openReports: number;
  scheduled: number;
  difficulty: { difficulty: Difficulty; completions: number; seconds: number; moves: number }[];
  leaders: Leader[];
  activity: { id: string; action: string; detail: string; date: string; username: string | null }[];
}

export function AdminOverview() {
  const state = useAdminData<Overview>('/overview');
  return (
    <DataState {...state}>
      {state.data && (
        <>
          <div className="admin-stats">
            {[
              {
                label: 'Registered players',
                value: state.data.users.total,
                detail: `${state.data.users.active || 0} active accounts`,
                icon: Users,
                color: 'green',
              },
              {
                label: 'Puzzles completed',
                value: state.data.stats.completions,
                detail: `${state.data.stats.players} players making progress`,
                icon: Trophy,
                color: 'purple',
              },
              {
                label: 'Open reports',
                value: state.data.openReports,
                detail: 'A little help goes a long way',
                icon: MessageSquare,
                color: 'orange',
              },
              {
                label: 'Scheduled puzzles',
                value: state.data.scheduled,
                detail: 'Fresh challenges on the way',
                icon: CalendarDays,
                color: 'blue',
              },
            ].map(({ label, value, detail, icon: Icon, color }) => (
              <div className="stat-card" key={label}>
                <span className={`stat-icon ${color}`}>
                  <Icon size={21} />
                </span>
                <div className="stat-content">
                  <span className="stat-label">{label}</span>
                  <strong className="stat-value">{value.toLocaleString()}</strong>
                  <span className="stat-caption">{detail}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="admin-overview-grid">
            <section className="panel">
              <SectionTitle
                title="How your community plays"
                subtitle="Completed Sliding Puzzles, by difficulty."
              />
              {(Object.keys(DIFFICULTIES) as Difficulty[]).map((key) => {
                const stats = state.data!.difficulty.find((row) => row.difficulty === key);
                const count = stats?.completions || 0;
                return (
                  <div className="admin-difficulty-row" key={key}>
                    <div>
                      <span>{DIFFICULTIES[key].label}</span>
                      <strong>{count}</strong>
                    </div>
                    <div className="xp-track">
                      <span
                        style={{
                          width: `${state.data!.stats.completions ? (count / state.data!.stats.completions) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <p>
                      {count
                        ? `${time(stats!.seconds)} average time · ${stats!.moves} average moves`
                        : 'No completions yet'}
                    </p>
                  </div>
                );
              })}
              <div className="admin-summary-note">
                <Clock3 size={15} />
                {time(state.data.stats.seconds)} total play time ·{' '}
                {state.data.stats.points.toLocaleString()} points earned
              </div>
            </section>
            <section className="panel">
              <SectionTitle
                title="The leading minds"
                subtitle="Current global standings. Active accounts only."
              />
              {state.data.leaders.length ? (
                <div className="admin-leader-list">
                  {state.data.leaders.map((row) => (
                    <div key={row.id}>
                      <span className="admin-rank">{row.rank}</span>
                      <span className="avatar">{row.avatar}</span>
                      <div>
                        <strong>{row.username}</strong>
                        <small>Level {row.level}</small>
                      </div>
                      <b>{row.score.toLocaleString()}</b>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Trophy size={28} />}
                  title="The first win is waiting."
                  description="Registered player scores will appear here after a completed puzzle."
                />
              )}
            </section>
          </div>
          <section className="panel admin-audit">
            <SectionTitle
              title="Studio activity"
              subtitle="A record of administrator changes."
              action="Refresh"
              onClick={state.refresh}
            />
            {state.data.activity.length ? (
              <div className="admin-activity-list">
                {state.data.activity.map((item) => (
                  <div key={item.id}>
                    <span className="admin-activity-dot" />
                    <div>
                      <strong>{item.action.replaceAll('.', ' · ')}</strong>
                      <p>{item.detail}</p>
                      <small>
                        {item.username ||
                          (item.action === 'admin.grant'
                            ? 'Server owner'
                            : 'Former administrator')}{' '}
                        · {new Date(item.date).toLocaleString()}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="admin-empty-copy">Your first studio change will appear here.</p>
            )}
          </section>
        </>
      )}
    </DataState>
  );
}
