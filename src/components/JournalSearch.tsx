'use client';

import { useState, useMemo, useCallback } from 'react';
import { Search, Calendar, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getEntries } from '@/lib/storage';
import { MOOD_CONFIGS, MOOD_LIST } from '@/lib/moods';
import type { JournalEntry, MoodType } from '@/lib/types';

export default function JournalSearch() {
  const [keyword, setKeyword] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMoods, setSelectedMoods] = useState<MoodType[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<JournalEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const toggleMood = useCallback((mood: MoodType) => {
    setSelectedMoods((prev) =>
      prev.includes(mood) ? prev.filter((m) => m !== mood) : [...prev, mood]
    );
  }, []);

  const clearFilters = useCallback(() => {
    setKeyword('');
    setStartDate('');
    setEndDate('');
    setSelectedMoods([]);
    setHasSearched(false);
    setResults([]);
    setError('');
  }, []);

  const handleSearch = useCallback(() => {
    const hasKeyword = keyword.trim().length > 0;
    const hasDateRange = startDate || endDate;
    const hasMood = selectedMoods.length > 0;

    if (!hasKeyword && !hasDateRange && !hasMood) {
      setError('请至少填写一个搜索条件');
      return;
    }

    setError('');
    const allEntries = getEntries();

    const filtered = allEntries.filter((entry: JournalEntry) => {
      if (hasKeyword && !entry.content.toLowerCase().includes(keyword.trim().toLowerCase())) {
        return false;
      }

      if (hasDateRange) {
        const entryDate = new Date(entry.createdAt).toISOString().split('T')[0];
        if (startDate && entryDate < startDate) return false;
        if (endDate && entryDate > endDate) return false;
      }

      if (hasMood && !selectedMoods.includes(entry.mood)) {
        return false;
      }

      return true;
    });

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setResults(filtered);
    setHasSearched(true);
  }, [keyword, startDate, endDate, selectedMoods]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const highlightText = useCallback(
    (text: string) => {
      if (!keyword.trim()) return text;
      const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      const parts = text.split(regex);
      return parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-primary/20 text-foreground rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      );
    },
    [keyword]
  );

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  };

  const groupedResults = useMemo(() => {
    const groups: Record<string, JournalEntry[]> = {};
    results.forEach((entry) => {
      const dateKey = new Date(entry.createdAt).toISOString().split('T')[0];
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(entry);
    });
    return Object.entries(groups).sort(([a]: [string, JournalEntry[]], [b]: [string, JournalEntry[]]) => b.localeCompare(a));
  }, [results]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center">
            <Search className="size-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-medium">搜索日记</h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">关键词</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入关键词搜索日记内容..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Calendar className="size-3" />
              时间范围
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
              />
              <span className="text-xs text-muted-foreground">至</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
              <Filter className="size-3" />
              情绪筛选
            </label>
            <div className="flex flex-wrap gap-1.5">
              {MOOD_LIST.map((mood) => {
                const config = MOOD_CONFIGS[mood];
                const isSelected = selectedMoods.includes(mood);
                return (
                  <button
                    key={mood}
                    onClick={() => toggleMood(mood)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all duration-200 border"
                    style={{
                      backgroundColor: isSelected ? config.bgColor + '40' : 'transparent',
                      borderColor: isSelected ? config.bgColor : 'var(--border)',
                      color: isSelected ? config.color : 'var(--muted-foreground)',
                    }}
                  >
                    <span>{config.emoji}</span>
                    <span>{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleSearch}
              variant="default"
              size="sm"
              className="rounded-xl flex-1"
            >
              <Search className="size-3.5 mr-1" />
              搜索
            </Button>
            {(keyword || startDate || endDate || selectedMoods.length > 0) && (
              <Button
                onClick={clearFilters}
                variant="ghost"
                size="sm"
                className="rounded-xl"
              >
                <X className="size-3.5 mr-1" />
                清空
              </Button>
            )}
          </div>

          {error && (
            <p className="text-xs text-destructive text-center fade-enter">{error}</p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {!hasSearched ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Search className="size-8 mb-3 opacity-30" />
            <p className="text-sm">设置搜索条件，查找你的日记</p>
            <p className="text-xs mt-1">支持关键词、时间范围、情绪筛选</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">没有找到匹配的日记</p>
            <p className="text-xs mt-1">试试调整搜索条件</p>
          </div>
        ) : (
          <div className="space-y-4 fade-enter">
            <p className="text-xs text-muted-foreground">
              找到 <span className="text-primary font-medium">{results.length}</span> 条日记
            </p>

            {groupedResults.map(([dateKey, entries]) => (
              <div key={dateKey}>
                <p className="text-xs font-medium text-muted-foreground mb-2 px-1">
                  {formatDate(entries[0].createdAt)}
                </p>
                <div className="space-y-2">
                  {entries.map((entry) => {
                    const moodConfig = MOOD_CONFIGS[entry.mood];
                    const isExpanded = expandedId === entry.id;
                    const contentPreview =
                      entry.content.length > 80
                        ? entry.content.slice(0, 80) + '...'
                        : entry.content;

                    return (
                      <div
                        key={entry.id}
                        className="rounded-xl border border-border p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.createdAt).toLocaleTimeString('zh-CN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px]"
                            style={{
                              backgroundColor: moodConfig.bgColor + '40',
                              color: moodConfig.color,
                            }}
                          >
                            {moodConfig.emoji} {moodConfig.label}
                          </span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">
                          {isExpanded ? highlightText(entry.content) : highlightText(contentPreview)}
                        </p>
                        {isExpanded && (
                          <p className="text-[10px] text-muted-foreground mt-2">
                            更新于 {formatDateTime(entry.updatedAt)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
