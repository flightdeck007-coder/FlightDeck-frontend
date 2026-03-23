'use client';

import { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, ChevronUp, Paperclip, Plus, Loader2, Save } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { meetingsService } from '@/lib/api/meetings.service';

interface MeetingNotesSectionProps {
  meetingId: string;
  organizationId: string;
  sectionId: string;
  initialContent: string;
  currentUserId?: string | null;
  /** Only facilitator or scribe can add/edit notes */
  canEdit?: boolean;
  onSaved?: () => void;
}

export function MeetingNotesSection({
  meetingId,
  organizationId,
  sectionId,
  initialContent,
  currentUserId,
  canEdit = true,
  onSaved,
}: MeetingNotesSectionProps) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ id: string; fileName: string; mimeType?: string }>>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const loadAttachments = async () => {
    if (!organizationId || !meetingId) return;
    setLoadingAttachments(true);
    try {
      const list = await meetingsService.getAttachments(organizationId, meetingId);
      setAttachments(list.map((a) => ({ id: a.id, fileName: a.fileName, mimeType: a.mimeType })));
    } catch {
      setAttachments([]);
    } finally {
      setLoadingAttachments(false);
    }
  };

  useEffect(() => {
    loadAttachments();
  }, [organizationId, meetingId]);

  const handleSave = async () => {
    if (!canEdit || !organizationId || !meetingId || !sectionId) return;
    setSaving(true);
    try {
      await meetingsService.saveNote(organizationId, meetingId, sectionId, content);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const handleAddAttachment = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !organizationId || !meetingId) return;
    e.target.value = '';
    setUploading(true);
    try {
      await meetingsService.uploadAttachment(organizationId, meetingId, file);
      await loadAttachments();
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = (attachmentId: string, fileName: string) => {
    if (!organizationId || !meetingId) return;
    meetingsService.downloadAttachment(organizationId, meetingId, attachmentId, fileName);
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20 hover:bg-muted/30 transition-colors text-left"
      >
        <span className="text-muted-foreground">
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </span>
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <span className="font-semibold text-foreground">Flight Notes</span>
      </button>
      {!collapsed && (
        <div className="p-4">
          {canEdit && (
            <div className="flex items-center justify-end gap-2 mb-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-70"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
            </div>
          )}
          {!canEdit && (
            <p className="text-xs text-muted-foreground mb-2">Only the Pilot In Charge or Safety Officer can add or edit flight notes.</p>
          )}
          <RichTextEditor
            value={content}
            onChange={canEdit ? setContent : () => {}}
            placeholder="Flight Notes..."
            className={`min-h-[200px] border border-border rounded-md ${!canEdit ? 'opacity-80 pointer-events-none bg-muted/30' : ''}`}
          />
          <div className="mt-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-sm font-medium text-foreground">Attachments</span>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,image/*"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={handleAddAttachment}
                disabled={uploading}
                className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                aria-label="Add attachment"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
            {loadingAttachments ? (
              <p className="text-sm text-muted-foreground">Loading attachments…</p>
            ) : attachments.length > 0 ? (
              <ul className="space-y-1.5">
                {attachments.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-sm">
                    <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <button
                      type="button"
                      onClick={() => handleDownload(a.id, a.fileName)}
                      className="text-primary hover:underline truncate max-w-[200px] text-left"
                    >
                      {a.fileName}
                    </button>
                    <span className="text-muted-foreground text-xs">(download)</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No attachments yet. Click + to add.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
