import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  useEffect(() => {
    document.title = 'Not found | Printello POD';
  }, []);

  return (
    <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
      <h1 className="text-2xl font-semibold text-ink">Page not found</h1>
      <p className="mt-2 text-muted">That link doesn’t lead anywhere.</p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-full bg-brand-600 px-6 py-2.5 text-sm font-medium text-white"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
