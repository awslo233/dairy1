import type { JournalEntry, ChatMessage, MoodType } from './types';
import { MOOD_CONFIGS } from './moods';

const JOURNAL_KEY = 'adhd-journal-entries';
const CHAT_KEY = 'adhd-journal-chat';
const DRAFT_KEY = 'adhd-journal-draft';

export function getEntries(): JournalEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveEntry(entry: JournalEntry): void {
  const entries = getEntries();
  const idx = entries.findIndex((e) => e.id === entry.id);
  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.unshift(entry);
  }
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
}

export function deleteEntry(id: string): void {
  const entries = getEntries().filter((e) => e.id !== id);
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
}

export function getEntriesByDate(dateStr: string): JournalEntry[] {
  return getEntries().filter((e) => e.createdAt.startsWith(dateStr));
}

export function getAllEntriesForAnalysis(): JournalEntry[] {
  return getEntries();
}

export function getChatMessages(): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveChatMessage(msg: ChatMessage): void {
  const messages = getChatMessages();
  messages.push(msg);
  localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
}

export function clearChatHistory(): void {
  localStorage.removeItem(CHAT_KEY);
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

// --- 数据导出/导入 ---
export interface ExportData {
  version: number;
  exportedAt: string;
  entries: JournalEntry[];
  chatMessages: ChatMessage[];
}

export function exportAllData(): ExportData {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: getEntries(),
    chatMessages: getChatMessages(),
  };
}

export function importAllData(data: ExportData): { success: boolean; message: string } {
  try {
    if (!data || !Array.isArray(data.entries)) {
      return { success: false, message: '文件格式不正确' };
    }

    const validEntries = data.entries.filter(
      (e) => e.id && e.content && e.mood && e.createdAt
    );

    const existingEntries = getEntries();
    const existingIds = new Set(existingEntries.map((e) => e.id));
    const newEntries = validEntries.filter((e) => !existingIds.has(e.id));
    const mergedEntries = [...newEntries, ...existingEntries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    localStorage.setItem(JOURNAL_KEY, JSON.stringify(mergedEntries));

    if (Array.isArray(data.chatMessages)) {
      const existingMsgs = getChatMessages();
      const existingMsgIds = new Set(existingMsgs.map((m) => m.id));
      const newMsgs = data.chatMessages.filter((m) => !existingMsgIds.has(m.id));
      const mergedMsgs = [...existingMsgs, ...newMsgs];
      localStorage.setItem(CHAT_KEY, JSON.stringify(mergedMsgs));
    }

    return {
      success: true,
      message: `成功导入 ${newEntries.length} 篇新日记`,
    };
  } catch {
    return { success: false, message: '导入失败，请检查文件格式' };
  }
}

export function clearAllData(): void {
  localStorage.removeItem(JOURNAL_KEY);
  localStorage.removeItem(CHAT_KEY);
  localStorage.removeItem(DRAFT_KEY);
}

// --- Markdown 导出 ---
const WEEKDAY_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function formatDateTimeLocal(isoString: string): { date: string; time: string; weekday: string } {
  const d = new Date(isoString);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const weekday = WEEKDAY_NAMES[d.getDay()];
  return {
    date: `${year}年${month}月${day}日`,
    time: `${hours}:${minutes}`,
    weekday,
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function exportAsMarkdown(): string {
  const entries = getEntries();
  const now = formatDateTimeLocal(new Date().toISOString());

  if (entries.length === 0) {
    return `# 我的日记记录\n\n导出时间：${now.date} ${now.time}\n\n---\n\n暂无日记记录。\n`;
  }

  const grouped = new Map<string, JournalEntry[]>();
  for (const entry of entries) {
    const { date, weekday } = formatDateTimeLocal(entry.createdAt);
    const key = `${date} ${weekday}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(entry);
  }

  const sortedGroups = Array.from(grouped.entries()).sort((a, b) => {
    const dateA = a[0].split(' ').slice(0, 1).join(' ');
    const dateB = b[0].split(' ').slice(0, 1).join(' ');
    return dateB.localeCompare(dateA);
  });

  let md = `# 我的日记记录\n\n`;
  md += `导出时间：${now.date} ${now.time}\n`;
  md += `导出范围：全部记录（共 ${entries.length} 篇）\n\n`;
  md += `---\n`;

  for (const [dateKey, dayEntries] of sortedGroups) {
    md += `\n## ${dateKey}\n`;

    const sorted = [...dayEntries].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (const entry of sorted) {
      const { time } = formatDateTimeLocal(entry.createdAt);
      const moodLabel = MOOD_CONFIGS[entry.mood as MoodType]?.label || entry.mood;
      const content = stripHtml(entry.content);

      md += `\n### ${time} 【情绪：${moodLabel}】\n\n`;
      md += `${content}\n`;
    }

    md += `\n---\n`;
  }

  return md;
}
