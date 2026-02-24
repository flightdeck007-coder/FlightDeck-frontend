'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Quote,
  Link as LinkIcon,
  Undo,
  Redo,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  MoreHorizontal,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

const ALLOWED_LINK_PROTOCOLS = ['http://', 'https://', 'mailto:'];

function Toolbar({ editor }: { editor: Editor | null }) {
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [headingOpen, setHeadingOpen] = useState(false);

  if (!editor) return null;

  const setLink = () => {
    if (linkUrl === '') return;
    const url = linkUrl.trim().startsWith('http') ? linkUrl.trim() : `https://${linkUrl.trim()}`;
    editor.chain().focus().setLink({ href: url }).run();
    setLinkUrl('');
    setShowLinkInput(false);
  };

  return (
    <div className="border border-border border-b-0 rounded-t-md bg-muted/30">
      {/* Row 1: format, align, lists, paragraph, insert, more */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-accent ${editor.isActive('bold') ? 'bg-accent text-primary' : 'text-foreground/70'}`}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded hover:bg-accent ${editor.isActive('italic') ? 'bg-accent text-primary' : 'text-foreground/70'}`}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-1.5 rounded hover:bg-accent ${editor.isActive('underline') ? 'bg-accent text-primary' : 'text-foreground/70'}`}
          title="Underline"
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>
        <span className="w-px h-5 bg-border mx-0.5" aria-hidden />
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`p-1.5 rounded hover:bg-accent ${editor.isActive({ textAlign: 'left' }) ? 'bg-accent text-primary' : 'text-foreground/70'}`}
          title="Align left"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`p-1.5 rounded hover:bg-accent ${editor.isActive({ textAlign: 'center' }) ? 'bg-accent text-primary' : 'text-foreground/70'}`}
          title="Align center"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`p-1.5 rounded hover:bg-accent ${editor.isActive({ textAlign: 'right' }) ? 'bg-accent text-primary' : 'text-foreground/70'}`}
          title="Align right"
        >
          <AlignRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={`p-1.5 rounded hover:bg-accent ${editor.isActive({ textAlign: 'justify' }) ? 'bg-accent text-primary' : 'text-foreground/70'}`}
          title="Justify"
        >
          <AlignJustify className="w-4 h-4" />
        </button>
        <span className="w-px h-5 bg-border mx-0.5" aria-hidden />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded hover:bg-accent ${editor.isActive('bulletList') ? 'bg-accent text-primary' : 'text-foreground/70'}`}
          title="Bullet list"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded hover:bg-accent ${editor.isActive('orderedList') ? 'bg-accent text-primary' : 'text-foreground/70'}`}
          title="Numbered list"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-1.5 rounded hover:bg-accent ${editor.isActive('blockquote') ? 'bg-accent text-primary' : 'text-foreground/70'}`}
          title="Blockquote"
        >
          <Quote className="w-4 h-4" />
        </button>
        <span className="w-px h-5 bg-border mx-0.5" aria-hidden />
        {/* Paragraph / Headings */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setHeadingOpen((o) => !o)}
            className={`p-1.5 rounded hover:bg-accent flex items-center gap-0.5 ${editor.isActive('heading') ? 'bg-accent text-primary' : 'text-foreground/70'}`}
            title="Paragraph / Headings"
          >
            <Pilcrow className="w-4 h-4" />
          </button>
          {headingOpen && (
            <>
              <div className="absolute left-0 top-full mt-0.5 py-1 bg-card border border-border rounded-md shadow-lg z-20 min-w-[140px]">
                <button
                  type="button"
                  onClick={() => { editor.chain().focus().setParagraph().run(); setHeadingOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent rounded-none"
                >
                  Paragraph
                </button>
                <button
                  type="button"
                  onClick={() => { editor.chain().focus().toggleHeading({ level: 1 }).run(); setHeadingOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent rounded-none flex items-center gap-2"
                >
                  <Heading1 className="w-4 h-4" /> Heading 1
                </button>
                <button
                  type="button"
                  onClick={() => { editor.chain().focus().toggleHeading({ level: 2 }).run(); setHeadingOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent rounded-none flex items-center gap-2"
                >
                  <Heading2 className="w-4 h-4" /> Heading 2
                </button>
                <button
                  type="button"
                  onClick={() => { editor.chain().focus().toggleHeading({ level: 3 }).run(); setHeadingOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent rounded-none flex items-center gap-2"
                >
                  <Heading3 className="w-4 h-4" /> Heading 3
                </button>
              </div>
              <div className="fixed inset-0 z-10" onClick={() => setHeadingOpen(false)} aria-hidden />
            </>
          )}
        </div>
        {/* Link */}
        <div className="relative">
          {showLinkInput ? (
            <div className="flex items-center gap-1 px-1">
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setLink(); if (e.key === 'Escape') setShowLinkInput(false); }}
                placeholder="https://..."
                className="px-2 py-1 text-sm border border-border rounded w-40 bg-background text-foreground"
                autoFocus
              />
              <button type="button" onClick={setLink} className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded">Add</button>
              <button type="button" onClick={() => { setShowLinkInput(false); setLinkUrl(''); }} className="text-xs px-2 py-1 rounded hover:bg-accent">Cancel</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => editor.isActive('link') ? editor.chain().focus().unsetLink().run() : setShowLinkInput(true)}
              className={`p-1.5 rounded hover:bg-accent ${editor.isActive('link') ? 'bg-accent text-primary' : 'text-foreground/70'}`}
              title="Insert link"
            >
              <LinkIcon className="w-4 h-4" />
            </button>
          )}
        </div>
        <span className="w-px h-5 bg-border mx-0.5" aria-hidden />
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-1.5 rounded hover:bg-accent text-foreground/70 disabled:opacity-40"
          title="Undo"
        >
          <Undo className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-1.5 rounded hover:bg-accent text-foreground/70 disabled:opacity-40"
          title="Redo"
        >
          <Redo className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setShowMore((m) => !m)}
          className="p-1.5 rounded hover:bg-accent text-foreground/70"
          title="More options"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
      {/* Row 2 (More): indent / outdent — only if supported by extensions */}
      {showMore && (
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1 border-t border-border/50">
          {(editor.can() as { outdent?: () => boolean }).outdent?.() && (
            <button
              type="button"
              onClick={() => (editor.chain().focus() as unknown as { outdent: () => { run: () => boolean } }).outdent().run()}
              className="p-1.5 rounded hover:bg-accent text-foreground/70 text-xs"
              title="Decrease indent"
            >
              Decrease indent
            </button>
          )}
          {(editor.can() as { indent?: () => boolean }).indent?.() && (
            <button
              type="button"
              onClick={() => (editor.chain().focus() as unknown as { indent: () => { run: () => boolean } }).indent().run()}
              className="p-1.5 rounded hover:bg-accent text-foreground/70 text-xs"
              title="Increase indent"
            >
              Increase indent
            </button>
          )}
          {!(editor.can() as { outdent?: () => boolean }).outdent?.() && !(editor.can() as { indent?: () => boolean }).indent?.() && (
            <span className="text-xs text-muted-foreground py-1">More formatting options can be added here.</span>
          )}
        </div>
      )}
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Add a description (optional)...',
  className = '',
  id,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: '_blank', rel: 'noopener' },
        validate: (href) => ALLOWED_LINK_PROTOCOLS.some((p) => href.startsWith(p)),
      }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class:
          'min-h-[120px] px-3 py-2 focus:outline-none text-foreground text-sm',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  const updateContent = useCallback(() => {
    if (!editor) return;
    const next = value ?? '';
    if (editor.getHTML() !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    updateContent();
  }, [value, updateContent]);

  return (
    <div className={className} id={id}>
      <div className="border border-border rounded-md overflow-hidden bg-background">
        <Toolbar editor={editor} />
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
