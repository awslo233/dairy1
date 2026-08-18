'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Bold, Italic, List, ListOrdered, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MOOD_CONFIGS, MOOD_LIST } from '@/lib/moods';
import type { MoodType } from '@/lib/types';
import { formatDate } from '@/lib/storage';

const DRAFT_KEY = 'adhd-journal-draft';

interface DraftData {
  content: string;
  mood: MoodType | null;
}

function loadDraft(): DraftData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDraft(data: DraftData): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
}

function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY);
}

interface JournalEditorProps {
  onSave: (content: string, mood: MoodType, date?: string) => void;
  initialContent?: string;
  initialMood?: MoodType;
  initialDate?: string;
  editingId?: string | null;
  onCancelEdit?: () => void;
}

export default function JournalEditor({
  onSave,
  initialContent,
  initialMood,
  initialDate,
  editingId,
  onCancelEdit,
}: JournalEditorProps) {
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(initialMood ?? null);
  const [editDate, setEditDate] = useState<string>(initialDate || formatDate(new Date()));
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const isRestoringRef = useRef(false);

  useEffect(() => {
    if (editingId && initialContent) {
      if (editorRef.current) {
        isRestoringRef.current = true;
        editorRef.current.innerHTML = initialContent;
        setTimeout(() => { isRestoringRef.current = false; }, 0);
      }
      if (initialMood) setSelectedMood(initialMood);
      if (initialDate) setEditDate(initialDate);
      return;
    }

    const draft = loadDraft();
    if (draft && (draft.content || draft.mood)) {
      if (editorRef.current && draft.content) {
        isRestoringRef.current = true;
        editorRef.current.innerHTML = draft.content;
        setTimeout(() => { isRestoringRef.current = false; }, 0);
      }
      if (draft.mood) setSelectedMood(draft.mood);
      setHasDraft(true);
    }
  }, [editingId, initialContent, initialMood, initialDate]);

  const handleInput = useCallback(() => {
    if (isRestoringRef.current || editingId) return;
    const content = editorRef.current?.innerHTML || '';
    saveDraft({ content, mood: selectedMood });
    setHasDraft(true);
  }, [selectedMood, editingId]);

  useEffect(() => {
    if (isRestoringRef.current || editingId) return;
    const content = editorRef.current?.innerHTML || '';
    if (content || selectedMood) {
      saveDraft({ content, mood: selectedMood });
      setHasDraft(true);
    }
  }, [selectedMood, editingId]);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  }, []);

  const handleSave = useCallback(() => {
    const content = editorRef.current?.innerHTML || '';
    const textContent = editorRef.current?.textContent?.trim() || '';

    if (!textContent) return;
    if (!selectedMood) return;

    setIsSaving(true);

    setTimeout(() => {
      onSave(content, selectedMood, editingId ? editDate : undefined);
      setIsSaving(false);
      setShowSaved(true);

      setTimeout(() => {
        setShowSaved(false);
        if (editorRef.current) {
          editorRef.current.innerHTML = '';
        }
        setSelectedMood(null);
        setEditDate(formatDate(new Date()));
        clearDraft();
        setHasDraft(false);
      }, 800);
    }, 300);
  }, [selectedMood, editDate, editingId, onSave]);

  const handleCancel = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
    setSelectedMood(null);
    clearDraft();
    setHasDraft(false);
    onCancelEdit?.();
  }, [onCancelEdit]);

  const handleDiscardDraft = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
    setSelectedMood(null);
    clearDraft();
    setHasDraft(false);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {editingId ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors">
              <Calendar className="size-3.5 text-primary" />
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="bg-transparent text-sm text-foreground border-none outline-none cursor-pointer"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasDraft && !editingId && (
            <span className="text-xs px-2 py-1 rounded-full bg-secondary/60 text-secondary-foreground flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-primary/50" />
              草稿已自动保存
            </span>
          )}
          {editingId && (
            <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
              编辑模式
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-card border border-border">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => execCommand('bold')}
          className="rounded-lg hover:bg-accent"
          title="粗体"
        >
          <Bold className="size-4 text-muted-foreground" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => execCommand('italic')}
          className="rounded-lg hover:bg-accent"
          title="斜体"
        >
          <Italic className="size-4 text-muted-foreground" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => execCommand('insertUnorderedList')}
          className="rounded-lg hover:bg-accent"
          title="无序列表"
        >
          <List className="size-4 text-muted-foreground" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => execCommand('insertOrderedList')}
          className="rounded-lg hover:bg-accent"
          title="有序列表"
        >
          <ListOrdered className="size-4 text-muted-foreground" />
        </Button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="journal-content min-h-[200px] max-h-[400px] overflow-y-auto p-4 rounded-2xl bg-card border border-border focus:border-primary/40 focus:ring-2 focus:ring-primary/10 outline-none transition-all duration-200 custom-scrollbar"
        style={{ fontSize: '17px', lineHeight: '1.8' }}
        data-placeholder="今天想写点什么？随便聊聊就好..."
      />

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">此刻的心情</p>
        <div className="flex flex-wrap gap-2">
          {MOOD_LIST.map((mood) => {
            const config = MOOD_CONFIGS[mood];
            const isSelected = selectedMood === mood;
            return (
              <button
                key={mood}
                onClick={() => setSelectedMood(mood)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all duration-200 border"
                style={{
                  backgroundColor: isSelected ? config.bgColor : 'transparent',
                  borderColor: isSelected ? config.bgColor : '#EDE9E3',
                  color: isSelected ? config.color : '#8A8690',
                  transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                }}
              >
                <span>{config.emoji}</span>
                <span>{config.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={handleSave}
          disabled={!selectedMood || isSaving}
          className={`rounded-xl px-6 h-10 transition-all duration-200 ${
            isSaving ? 'save-animate' : ''
          }`}
          style={{
            backgroundColor: isSaving ? '#7FB5A0' : undefined,
          }}
        >
          {showSaved ? (
            <span className="check-animate flex items-center gap-1">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 8l3 3 7-7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              已保存
            </span>
          ) : isSaving ? (
            '保存中...'
          ) : (
            '保存日记'
          )}
        </Button>

        {hasDraft && !editingId && (
          <Button
            variant="ghost"
            onClick={handleDiscardDraft}
            className="rounded-xl text-muted-foreground text-sm"
          >
            清空草稿
          </Button>
        )}

        {editingId && (
          <Button
            variant="ghost"
            onClick={handleCancel}
            className="rounded-xl text-muted-foreground"
          >
            取消编辑
          </Button>
        )}
      </div>

      <style jsx>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #8A8690;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
