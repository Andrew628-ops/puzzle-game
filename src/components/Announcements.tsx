import { useState } from 'react';
import { ArrowUpRight, Megaphone, X } from 'lucide-react';
import { useApp } from '../context';
import { readLocal, saveLocal } from '../lib';
import { Modal } from './UI';
import type { Announcement } from '../types';
export function AnnouncementReader({
  announcement,
  onClose,
}: {
  announcement: Announcement;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose} label="Community announcement">
      <span className="modal-feature-icon">
        <Megaphone size={30} />
      </span>
      <span className="eyebrow">A NOTE FROM PUZZLEMIND</span>
      <h2>{announcement.title}</h2>
      <p className="preserve-lines announcement-body">{announcement.body}</p>
      <button className="button primary full-width" style={{ marginTop: 25 }} onClick={onClose}>
        Back to the good stuff
        <ArrowUpRight size={16} />
      </button>
    </Modal>
  );
}
export function CommunityNews() {
  const { announcements } = useApp();
  const [dismissed, setDismissed] = useState<Record<string, string>>(() =>
      readLocal('pm-dismissed-news', {}),
    ),
    [selected, setSelected] = useState<Announcement | null>(null);
  const news = announcements.filter((item) => dismissed[item.id] !== item.updated_at).slice(0, 2);
  return (
    <>
      {news.map((item) => (
        <div className="community-news" key={item.id}>
          <span className="community-news-icon">
            <Megaphone size={20} />
          </span>
          <button className="community-news-copy" onClick={() => setSelected(item)}>
            <strong>{item.title}</strong>
            <span>{item.body}</span>
          </button>
          <button
            className="icon-button"
            aria-label={`Read announcement ${item.title}`}
            onClick={() => setSelected(item)}
          >
            <ArrowUpRight size={18} />
          </button>
          <button
            className="icon-button"
            aria-label={`Dismiss announcement ${item.title}`}
            onClick={() => {
              const next = { ...dismissed, [item.id]: item.updated_at };
              setDismissed(next);
              saveLocal('pm-dismissed-news', next);
            }}
          >
            <X size={16} />
          </button>
        </div>
      ))}
      {selected && <AnnouncementReader announcement={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
