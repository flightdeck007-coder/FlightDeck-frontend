'use client';

import { useState, useEffect } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Palette, X } from 'lucide-react';
import type { Theme } from '@/contexts/ThemeContext';

type TabId = 'appearance';

const TABS: { id: TabId; label: string }[] = [{ id: 'appearance', label: 'Appearance' }];

export function SettingsModal() {
  const { isOpen, closeSettings } = useSettings();
  const { theme, setTheme, primaryColor, setPrimaryColor, applyAppearance } = useTheme();
  const [activeTab, setActiveTab] = useState<TabId>('appearance');
  const [draftTheme, setDraftTheme] = useState<Theme>(theme);
  const [draftPrimary, setDraftPrimary] = useState(primaryColor);

  useEffect(() => {
    if (isOpen) {
      setDraftTheme(theme);
      setDraftPrimary(primaryColor);
      setActiveTab('appearance');
    }
  }, [isOpen, theme, primaryColor]);

  const handleSave = () => {
    const hex = draftPrimary.startsWith('#') ? draftPrimary : `#${draftPrimary}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      applyAppearance({ theme: draftTheme, primaryColor: hex });
    } else {
      applyAppearance({ theme: draftTheme });
    }
    closeSettings();
  };

  const handleCancel = () => {
    closeSettings();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-50"
        onClick={handleCancel}
        aria-hidden
      />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md max-h-[90vh] overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 id="settings-title" className="text-lg font-semibold text-foreground">
            Settings
          </h2>
          <button
            type="button"
            onClick={handleCancel}
            className="p-2 rounded-md text-foreground hover:bg-foreground/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-foreground/70 hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-12rem)]">
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              {/* Theme: Dark / Light */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Theme
                </label>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-foreground/70">Dark / Light</span>
                  <ThemeToggle
                    size="md"
                    theme={draftTheme}
                    onToggle={() => setDraftTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                  />
                </div>
                <p className="text-xs text-foreground/60 mt-1">
                  Toggle between light and dark mode.
                </p>
              </div>

              {/* Primary color */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  <span className="flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Website color
                  </span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={draftPrimary}
                    onChange={(e) => setDraftPrimary(e.target.value)}
                    className="w-12 h-12 rounded-lg border border-border cursor-pointer bg-transparent"
                    aria-label="Pick primary color"
                  />
                  <input
                    type="text"
                    value={draftPrimary}
                    onChange={(e) => setDraftPrimary(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm font-mono"
                    placeholder="#C47F19"
                  />
                </div>
                <p className="text-xs text-foreground/60 mt-1">
                  Choose an accent color. A lighter shade is used for secondary areas.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-accent/30">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 rounded-md border border-border text-foreground hover:bg-foreground/10 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium flex items-center gap-2"
          >
            Save
          </button>
        </div>
      </div>
    </>
  );
}
