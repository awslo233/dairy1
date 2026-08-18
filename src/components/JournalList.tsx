'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MOOD_CONFIGS } from '@/lib/moods';
import { formatTime } from '@/lib/storage';
import type { JournalEntry } from '@/lib/types';

interface JournalListProps {
  entries: JournalEntry[];
  onEdit: (entry: JournalEntry) => void;
  onDelete: (id: string) => void;
}

export default function JournalList({ entries, onEdit, onDelete }: JournalListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">这一天还没有日记</p>
        <p className="text-xs mt-1">去写一篇吧</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry) => {
        const moodConfig = MOOD_CONFIGS[entry.mood];
        const isExpanded = expandedId === entry.id;
        const plainText = entry.content.replace(/<[^>]*>/g, '');
        const summary = plainText.length > 80 ? plainText.slice(0, 80) + '...' : plainText;

        return (
          <div
            key={entry.id}
            className="rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                  style={{
                    backgroundColor: moodConfig.bgColor,
                    color: moodConfig.color,
                  }}
                >
                  {moodConfig.emoji} {moodConfig.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatTime(entry.createdAt)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onEdit(entry)}
                  className="rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onDelete(entry.id)}
                  className="rounded-lg text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>

            <div className="relative">
              {!isExpanded && plainText.length > 80 && (
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent" />
              )}
              <div
                className={isExpanded ? '' : 'max-h-[4.5em] overflow-hidden'}
                dangerouslySetInnerHTML={{ __html: entry.content }}
                style={{
                  fontSize: '15px',
                  lineHeight: '1.7',
                  color: '#3D3B40',
                }}
              />
            </div>

            {plainText.length > 80 && (
              <button
                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                className="flex items-center gap-1 mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {isExpanded ? (
                  <>
                    收起 <ChevronUp className="size-3" />
                  </>
                ) : (
                  <>
                    展开查看 <ChevronDown className="size-3" />
                  </>
                )}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
