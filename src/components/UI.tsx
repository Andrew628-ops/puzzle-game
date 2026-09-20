import { useEffect, useRef, type ReactNode } from 'react';
import {
  X,
  ArrowUpRight,
  Brain,
  CalendarDays,
  Crown,
  Flame,
  Footprints,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';
export function Modal({
  children,
  onClose,
  label,
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key === 'Tab') {
        const focusable = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,textarea,select,a[href]',
        );
        if (!focusable?.length) return;
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === ref.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        ref={ref}
      >
        <button className="icon-button modal-close" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}
export function SectionTitle({
  title,
  subtitle,
  action,
  onClick,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && (
        <button className="text-button" onClick={onClick}>
          {action}
          <ArrowUpRight size={16} />
        </button>
      )}
    </div>
  );
}
export function BadgeIcon({ name, size = 24 }: { name: string; size?: number }) {
  const Icon =
    (
      {
        footprints: Footprints,
        zap: Zap,
        target: Target,
        flame: Flame,
        brain: Brain,
        calendar: CalendarDays,
        trophy: Trophy,
        crown: Crown,
      } as Record<string, typeof Brain>
    )[name] || Trophy;
  return <Icon size={size} />;
}
export function EmptyState({
  icon,
  title,
  description,
  action,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <button className="button primary" onClick={onClick}>
          {action}
          <ArrowUpRight size={16} />
        </button>
      )}
    </div>
  );
}
