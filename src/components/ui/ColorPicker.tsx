'use client';

import { useState, useEffect } from 'react';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
  '#64748b', '#6b7280', '#78716c', '#57534e',
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  /**
   * Render the palette in place instead of in a popover. Use inside containers
   * that clip overflow, and where seeing every swatch at once helps the user
   * pick a colour that does not clash with a neighbouring one.
   */
  inline?: boolean;
}

export default function ColorPicker({ value, onChange, label, inline = false }: ColorPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [customColor, setCustomColor] = useState(value);

  // Keep the custom inputs in step when the colour is changed from outside
  // (e.g. resetting a calendar back to its person's colour).
  useEffect(() => { setCustomColor(value); }, [value]);

  const palette = (
    <>
      <div className="grid grid-cols-5 gap-2 mb-3">
        {PRESET_COLORS.map(color => (
          <button
            key={color}
            type="button"
            onClick={() => {
              onChange(color);
              setCustomColor(color);
              setShowPicker(false);
            }}
            className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${
              value === color ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'
            }`}
            style={{ backgroundColor: color }}
            aria-label={color}
          />
        ))}
      </div>
      <div className="border-t border-gray-100 dark:border-gray-700 pt-2">
        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Custom color</label>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={customColor}
            onChange={e => {
              setCustomColor(e.target.value);
              onChange(e.target.value);
            }}
            className="w-8 h-8 cursor-pointer rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700"
          />
          <input
            type="text"
            value={customColor}
            onChange={e => {
              setCustomColor(e.target.value);
              if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                onChange(e.target.value);
              }
            }}
            className="flex-1 text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1 font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="#000000"
            maxLength={7}
          />
        </div>
      </div>
    </>
  );

  if (inline) {
    return (
      <div>
        {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-10 h-10 rounded-lg border-2 border-gray-200 dark:border-gray-600 shadow-sm"
            style={{ backgroundColor: value }}
          />
          <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">{value}</span>
        </div>
        <div className="w-56">{palette}</div>
      </div>
    );
  }

  return (
    <div className="relative">
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className="w-10 h-10 rounded-lg border-2 border-gray-200 dark:border-gray-600 shadow-sm hover:border-gray-400 dark:hover:border-gray-400 transition-colors"
          style={{ backgroundColor: value }}
          aria-label={`Color: ${value}`}
        />
        <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">{value}</span>
      </div>

      {showPicker && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowPicker(false)}
          />
          <div className="absolute z-20 mt-2 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-600 w-56">
            {palette}
          </div>
        </>
      )}
    </div>
  );
}
