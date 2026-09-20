import { ArrowLeft, ArrowRight, LoaderCircle, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { EmptyState, Modal } from '../../components/UI';
import { useApp } from '../../context';
import { api } from '../../lib';
export function useAdminData<T>(path: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api<T>(`/admin${path}`)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, revision]);
  return { data, error, loading, refresh };
}

export function DataState({
  loading,
  error,
  refresh,
  children,
}: {
  loading: boolean;
  error: string;
  refresh: () => void;
  children: ReactNode;
}) {
  if (error)
    return (
      <EmptyState
        icon={<RefreshCw size={28} />}
        title="We couldn’t load this section."
        description={error}
        action="Try again"
        onClick={refresh}
      />
    );
  if (loading)
    return (
      <div className="admin-loading" role="status">
        <LoaderCircle size={24} className="spinner" />
        Loading the latest…
      </div>
    );
  return <>{children}</>;
}

export function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="admin-pagination">
      <span>
        Page {page} of {pages}
      </span>
      <button className="button secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ArrowLeft size={14} />
        Previous
      </button>
      <button
        className="button secondary"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Next
        <ArrowRight size={14} />
      </button>
    </div>
  );
}

export function RemoveDialog({
  label,
  title,
  description,
  path,
  onClose,
  onSaved,
}: {
  label: string;
  title: string;
  description: string;
  path: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const { refreshCatalog, setToast } = useApp();
  async function remove() {
    setBusy(true);
    setError('');
    try {
      await api(path, { method: 'DELETE' });
      await refreshCatalog();
      setToast('Removed successfully.');
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal onClose={onClose} label={label}>
      <h2>{title}</h2>
      <p>{description}</p>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="admin-confirm-actions">
        <button className="button secondary" disabled={busy} onClick={onClose}>
          Keep it
        </button>
        <button className="button danger-button" disabled={busy} onClick={() => void remove()}>
          <Trash2 size={15} />
          {busy ? 'Removing…' : 'Remove'}
        </button>
      </div>
    </Modal>
  );
}

export interface PageData<T> {
  rows: T[];
  total: number;
  page: number;
  pages: number;
}
