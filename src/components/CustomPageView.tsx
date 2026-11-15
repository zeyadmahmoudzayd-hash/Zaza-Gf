import { ArrowLeft } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';

export function CustomPageView() {
  const { data, selectedPageSlug, setActiveView } = usePlatform();
  if (!data) return null;

  const page = data.pages.find((p) => p.slug === selectedPageSlug);
  if (!page) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-slate-900">Page not found</h1>
        <button
          type="button"
          onClick={() => setActiveView('home')}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => setActiveView('home')}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </button>

      <article className="mt-6 rounded-xl border border-slate-200 bg-white p-8 sm:p-10">
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">{page.title}</h1>
        {page.subtitle && <p className="mt-2 text-base text-slate-600">{page.subtitle}</p>}
        <div className="mt-6 space-y-4 border-t border-slate-200 pt-6 text-sm leading-relaxed text-slate-700 whitespace-pre-line">
          {page.content}
        </div>
      </article>
    </div>
  );
}
