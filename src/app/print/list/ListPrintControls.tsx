'use client';

interface Props {
  title: string;
  prevMonth: string;
  nextMonth: string;
  currentMonth: string;
}

export default function ListPrintControls({ title, prevMonth, nextMonth, currentMonth }: Props) {
  return (
    <div className="no-print flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
      {/* Month navigation */}
      <div className="flex items-center gap-1">
        <a href={`/print/list?month=${prevMonth}`} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors" aria-label="Previous month">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <h1 className="text-base font-semibold text-gray-900 px-2 min-w-36 text-center">{title}</h1>
        <a href={`/print/list?month=${nextMonth}`} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors" aria-label="Next month">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      {/* Layout toggle */}
      <div className="flex items-center gap-1 bg-gray-200 rounded-lg p-0.5">
        <a
          href={`/print?month=${currentMonth}`}
          className="px-3 py-1 rounded-md text-xs font-medium text-gray-600 hover:bg-white hover:text-gray-900 transition-colors"
          title="Monthly grid view"
        >
          Grid
        </a>
        <span className="px-3 py-1 rounded-md text-xs font-medium bg-white text-gray-900 shadow-sm">
          List
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <a href="/" className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors">
          ← Calendar
        </a>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print
        </button>
      </div>
    </div>
  );
}
