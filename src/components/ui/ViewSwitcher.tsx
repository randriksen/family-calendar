'use client';

import type { ViewType, LocaleData } from '@/types';

interface ViewSwitcherProps {
  current: ViewType;
  onChange: (view: ViewType) => void;
  t: LocaleData;
}

const views: ViewType[] = ['month', 'week', 'rolling', 'agenda'];

export default function ViewSwitcher({ current, onChange, t }: ViewSwitcherProps) {
  return (
    <div className="flex bg-gray-100 rounded-lg p-1 gap-0.5">
      {views.map(view => (
        <button
          key={view}
          onClick={() => onChange(view)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            current === view
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
        >
          {t.views[view]}
        </button>
      ))}
    </div>
  );
}
