'use client';

import { useState } from 'react';
import type { Person, LocaleData } from '@/types';
import ColorPicker from '@/components/ui/ColorPicker';

interface PeopleSettingsProps {
  people: Person[];
  t: LocaleData;
  onRefresh: () => void;
}

export default function PeopleSettings({ people, t, onRefresh }: PeopleSettingsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#3b82f6');
  const [addName, setAddName] = useState('');
  const [addColor, setAddColor] = useState('#3b82f6');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = (person: Person) => {
    setEditingId(person.id);
    setEditName(person.name);
    setEditColor(person.color);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setError(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/people/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, color: editColor }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setEditingId(null);
      onRefresh();
    } catch {
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const deletePerson = async (id: string, name: string) => {
    if (!confirm(t.settings.people.confirmDelete)) return;
    try {
      const res = await fetch(`/api/people/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      onRefresh();
    } catch {
      alert('Failed to delete person');
    }
  };

  const addPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: addName.trim(), color: addColor }),
      });
      if (!res.ok) throw new Error('Failed to add person');
      setAddName('');
      setAddColor('#3b82f6');
      onRefresh();
    } catch {
      setError('Failed to add person');
    } finally {
      setAdding(false);
    }
  };

  const moveUp = async (index: number) => {
    if (index === 0) return;
    const newOrder = [...people];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    await fetch('/api/people/' + people[index].id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: newOrder.map(p => p.id) }),
    });
    onRefresh();
  };

  const moveDown = async (index: number) => {
    if (index === people.length - 1) return;
    const newOrder = [...people];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    await fetch('/api/people/' + people[index].id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: newOrder.map(p => p.id) }),
    });
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t.settings.people.title}</h2>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* People list */}
      <div className="space-y-2">
        {people.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">No people added yet.</p>
        )}
        {people.map((person, index) => (
          <div
            key={person.id}
            className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
          >
            {editingId === person.id ? (
              <div className="flex-1 flex flex-wrap items-center gap-3">
                <ColorPicker value={editColor} onChange={setEditColor} />
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={e => e.key === 'Enter' && saveEdit()}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? '...' : t.settings.people.save}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    {t.settings.people.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div
                  className="w-8 h-8 rounded-full flex-shrink-0 border-2 border-white dark:border-gray-800 shadow-sm"
                  style={{ backgroundColor: person.color }}
                />
                <span className="flex-1 font-medium text-gray-900 dark:text-gray-100">{person.name}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-25 rounded"
                    title={t.settings.people.moveUp}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => moveDown(index)}
                    disabled={index === people.length - 1}
                    className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-25 rounded"
                    title={t.settings.people.moveDown}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                <button
                  onClick={() => startEdit(person)}
                  className="px-2.5 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {t.settings.people.edit}
                </button>
                <button
                  onClick={() => deletePerson(person.id, person.name)}
                  className="px-2.5 py-1 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  {t.settings.people.delete}
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add person form */}
      <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t.settings.people.addPerson}</h3>
        <form onSubmit={addPerson} className="flex flex-wrap items-end gap-3">
          <ColorPicker
            value={addColor}
            onChange={setAddColor}
            label={t.settings.people.color}
          />
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t.settings.people.name}
            </label>
            <input
              type="text"
              value={addName}
              onChange={e => setAddName(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Name"
              required
            />
          </div>
          <button
            type="submit"
            disabled={adding || !addName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {adding ? '...' : t.settings.people.addPerson}
          </button>
        </form>
      </div>
    </div>
  );
}
