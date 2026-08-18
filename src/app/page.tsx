'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  BookOpen,
  CalendarDays,
  Search,
  PenLine,
  Download,
  Upload,
  Settings,
  X,
  Share2,
  FileText,
  ExternalLink,
  Lock,
  Shield,
  HardDrive,
  ChevronDown,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import JournalEditor from '@/components/JournalEditor';
import CalendarView from '@/components/CalendarView';
import JournalList from '@/components/JournalList';
import JournalSearch from '@/components/JournalSearch';
import {
  getEntriesByDate,
  saveEntry,
  deleteEntry,
  generateId,
  formatDate,
  exportAllData,
  exportAsMarkdown,
  importAllData,
  type ExportData,
} from '@/lib/storage';
import type { JournalEntry, MoodType, ViewMode } from '@/lib/types';

// --- Capacitor detection ---
function isCapacitor(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as unknown as { Capacitor?: unknown }).Capacitor;
}

async function capacitorSaveFile(filename: string, content: string): Promise<boolean> {
  if (!isCapacitor()) return false;
  const FS = (window as unknown as { Capacitor?: { Plugins?: { Filesystem?: any } } }).Capacitor?.Plugins?.Filesystem;
  if (!FS) return false;
  try {
    const base64 = btoa(unescape(encodeURIComponent(content)));
    await FS.writeFile({
      path: 'Download/' + filename,
      data: base64,
      directory: FS.Directory.ExternalStorage,
      encoding: FS.Encoding.UTF8,
    });
    return true;
  } catch (e) {
    console.warn('Capacitor save failed:', e);
    return false;
  }
}

async function capacitorShareFile(filename: string, content: string, title: string): Promise<boolean> {
  if (!isCapacitor()) return false;
  const FS = (window as unknown as { Capacitor?: { Plugins?: { Filesystem?: any; Share?: any } } }).Capacitor?.Plugins?.Filesystem;
  const SH = (window as unknown as { Capacitor?: { Plugins?: { Filesystem?: any; Share?: any } } }).Capacitor?.Plugins?.Share;
  if (!FS || !SH) return false;
  try {
    const base64 = btoa(unescape(encodeURIComponent(content)));
    await FS.writeFile({
      path: filename,
      data: base64,
      directory: FS.Directory.Cache,
      encoding: FS.Encoding.UTF8,
    });
    const uriRes = await FS.getUri({ directory: FS.Directory.Cache, path: filename });
    await SH.share({
      title,
      text: title,
      url: uriRes.uri,
      dialogTitle: '分享到...',
    });
    return true;
  } catch (e) {
    console.warn('Capacitor share failed:', e);
    return false;
  }
}

function isPWAStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (isCapacitor()) return false; // Capacitor app is not PWA
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

function isSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
}

function getStorageUsage(): { used: number; total: number; percentage: number } {
  if (typeof window === 'undefined') return { used: 0, total: 5 * 1024 * 1024, percentage: 0 };
  let totalSize = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key);
      if (value) {
        totalSize += key.length + value.length;
      }
    }
  }
  const usedBytes = totalSize * 2;
  const totalBytes = 5 * 1024 * 1024;
  return {
    used: usedBytes,
    total: totalBytes,
    percentage: Math.round((usedBytes / totalBytes) * 100),
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

type ThemeMode = 'auto' | 'light' | 'dark';

function shouldUseDarkMode(): boolean {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const currentTime = hour * 60 + minute;

  const startTime = 23 * 60 + 30;
  const endTime = 7 * 60 + 30;

  if (startTime > endTime) {
    return currentTime >= startTime || currentTime <= endTime;
  } else {
    return currentTime >= startTime && currentTime <= endTime;
  }
}

function getInitialThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'auto';
  const saved = localStorage.getItem('theme-mode');
  if (saved === 'light' || saved === 'dark' || saved === 'auto') {
    return saved;
  }
  return 'auto';
}

export default function Home() {
  const [view, setView] = useState<ViewMode>('write');
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [dayEntries, setDayEntries] = useState<JournalEntry[]>([]);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'calendar' | 'list'>('list');
  const [showSettings, setShowSettings] = useState(false);
  const [showPWAPrompt, setShowPWAPrompt] = useState(false);
  const [pwaAction, setPwaAction] = useState<'export' | 'exportMd' | 'share' | 'import'>('export');
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [storageUsage, setStorageUsage] = useState({ used: 0, total: 5 * 1024 * 1024, percentage: 0 });
  const [themeMode, setThemeMode] = useState<ThemeMode>('auto');
  const [isDark, setIsDark] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDayEntries(getEntriesByDate(selectedDate));
  }, [selectedDate, view]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isCapacitor()) return; // Skip welcome in Capacitor app
    const hasSeenWelcome = localStorage.getItem('has-seen-welcome');
    if (!hasSeenWelcome) {
      setShowWelcome(true);
    }
    const hasDismissedIOS = localStorage.getItem('dismissed-ios-guide');
    if (isIOSDevice() && isSafariBrowser() && !isPWAStandalone() && !hasDismissedIOS) {
      const timer = setTimeout(() => setShowIOSGuide(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isCapacitor()) return; // Skip in Capacitor
    if (isPWAStandalone()) return;
    const hasDismissed = localStorage.getItem('dismissed-install-prompt');
    if (hasDismissed) return;

    const handler = () => {
      const timer = setTimeout(() => setShowInstallPrompt(true), 5000);
      (window as unknown as { __installTimer: ReturnType<typeof setTimeout> }).__installTimer = timer;
    };

    window.addEventListener('pwa-installable', handler);
    return () => {
      window.removeEventListener('pwa-installable', handler);
      const timer = (window as unknown as { __installTimer?: ReturnType<typeof setTimeout> }).__installTimer;
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (showSettings || view === 'history') {
      setStorageUsage(getStorageUsage());
    }
  }, [showSettings, view, dayEntries]);

  useEffect(() => {
    if (importMsg) {
      const timer = setTimeout(() => setImportMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [importMsg]);

  useEffect(() => {
    if (shareMsg) {
      const timer = setTimeout(() => setShareMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [shareMsg]);

  useEffect(() => {
    if (showPrivacy) {
      const modal = document.getElementById('privacy-modal-content');
      if (modal) {
        modal.scrollTop = 0;
      }
    }
  }, [showPrivacy]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showPrivacy) {
        setShowPrivacy(false);
      }
    };
    if (showPrivacy) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [showPrivacy]);

  useEffect(() => {
    const savedMode = getInitialThemeMode();
    setThemeMode(savedMode);

    const applyTheme = () => {
      const dark = savedMode === 'auto' ? shouldUseDarkMode() : savedMode === 'dark';
      setIsDark(dark);
      if (dark) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.add('theme-transition');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('theme-transition');
      }
      setTimeout(() => {
        document.documentElement.classList.remove('theme-transition');
      }, 350);
    };

    applyTheme();

    if (savedMode === 'auto') {
      const interval = setInterval(() => {
        const dark = shouldUseDarkMode();
        setIsDark(dark);
        if (dark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }, 60000);
      return () => clearInterval(interval);
    }
  }, []);

  const handleThemeChange = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
    localStorage.setItem('theme-mode', mode);

    const dark = mode === 'auto' ? shouldUseDarkMode() : mode === 'dark';
    setIsDark(dark);

    document.documentElement.classList.add('theme-transition');
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 350);
  }, []);

  const handleInstallPWA = useCallback(async () => {
    const prompt = window.__deferredPrompt;
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === 'accepted') {
      setShowInstallPrompt(false);
    } else {
      localStorage.setItem('dismissed-install-prompt', 'true');
      setShowInstallPrompt(false);
    }
    window.__deferredPrompt = undefined;
  }, []);

  const handleSave = useCallback(
    (content: string, mood: MoodType, editDate?: string) => {
      const now = new Date();
      const nowISO = now.toISOString();

      if (editingEntry) {
        let createdAt: string;
        if (editDate) {
          const originalDate = new Date(editingEntry.createdAt);
          const [year, month, day] = editDate.split('-').map(Number);
          const newDate = new Date(originalDate);
          newDate.setFullYear(year, month - 1, day);
          createdAt = newDate.toISOString();
        } else {
          createdAt = editingEntry.createdAt;
        }

        const updated: JournalEntry = {
          ...editingEntry,
          content,
          mood,
          createdAt,
          updatedAt: nowISO,
        };
        saveEntry(updated);
        setEditingEntry(null);
      } else {
        const entry: JournalEntry = {
          id: generateId(),
          content,
          mood,
          createdAt: nowISO,
          updatedAt: nowISO,
        };
        saveEntry(entry);
      }

      setDayEntries(getEntriesByDate(selectedDate));
    },
    [editingEntry, selectedDate]
  );

  const handleEdit = useCallback((entry: JournalEntry) => {
    setEditingEntry(entry);
    setView('write');
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      deleteEntry(id);
      setDayEntries(getEntriesByDate(selectedDate));
    },
    [selectedDate]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingEntry(null);
  }, []);

  const handleDateSelect = useCallback((date: string) => {
    setSelectedDate(date);
    setDayEntries(getEntriesByDate(date));
    setMobilePanel('list');
  }, []);

  // --- Capacitor-aware export/share ---
  const doExport = useCallback(async () => {
    const data = exportAllData();
    const json = JSON.stringify(data, null, 2);
    const filename = `心流日记-备份-${formatDate(new Date())}.json`;

    // Try Capacitor first
    if (await capacitorSaveFile(filename, json)) {
      setShareMsg('已保存到下载文件夹');
      return;
    }

    // Browser fallback
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const doExportMarkdown = useCallback(async () => {
    const md = exportAsMarkdown();
    const filename = `心流日记-${formatDate(new Date())}.md`;

    // Try Capacitor first
    if (await capacitorSaveFile(filename, md)) {
      setShareMsg('已保存到下载文件夹');
      return;
    }

    // Browser fallback
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const doShare = useCallback(async () => {
    const md = exportAsMarkdown();
    const fileName = `心流日记-${formatDate(new Date())}.md`;

    // Try Capacitor share
    if (await capacitorShareFile(fileName, md, '心流日记 - 我的日记记录')) {
      setShareMsg('分享成功');
      return;
    }

    // Browser: Web Share API with files
    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([md], fileName, { type: 'text/markdown;charset=utf-8' });
        const shareData = {
          title: '心流日记 - 我的日记记录',
          text: '我的日记记录',
          files: [file],
        };

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          setShareMsg('分享成功');
          return;
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
      }

      try {
        const textShareData = {
          title: '心流日记 - 我的日记记录',
          text: md,
        };
        if (navigator.canShare(textShareData)) {
          await navigator.share(textShareData);
          setShareMsg('分享成功');
          return;
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
      }
    }

    // Final fallback: clipboard
    try {
      await navigator.clipboard.writeText(md);
      setShareMsg('已复制到剪贴板，可粘贴到任意 App');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = md;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setShareMsg('已复制到剪贴板，可粘贴到任意 App');
      } catch {
        setShareMsg('复制失败，请手动复制');
      }
      document.body.removeChild(textarea);
    }
  }, []);

  // PWA-wrapped handlers (skip PWA check in Capacitor)
  const withPWACheck = useCallback(
    (action: 'export' | 'exportMd' | 'share' | 'import', callback: () => void) => {
      return () => {
        if (isCapacitor()) {
          // In Capacitor, just run the callback directly
          callback();
          return;
        }
        if (isPWAStandalone()) {
          setPwaAction(action);
          setShowPWAPrompt(true);
        } else {
          callback();
        }
      };
    },
    []
  );

  const handleExport = withPWACheck('export', doExport);
  const handleExportMarkdown = withPWACheck('exportMd', doExportMarkdown);
  const handleShare = withPWACheck('share', doShare);

  const handleImport = useCallback(() => {
    if (isCapacitor()) {
      fileInputRef.current?.click();
      return;
    }
    if (isPWAStandalone()) {
      setPwaAction('import');
      setShowPWAPrompt(true);
    } else {
      fileInputRef.current?.click();
    }
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string) as ExportData;
          const result = importAllData(data);
          setImportMsg(result.message);
          if (result.success) {
            setDayEntries(getEntriesByDate(selectedDate));
          }
        } catch {
          setImportMsg('导入失败，请检查文件格式');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [selectedDate]
  );

  const handleOpenInBrowser = useCallback(() => {
    const url = window.location.href;
    window.open(url, '_blank');
    setShowPWAPrompt(false);
  }, []);

  const navItems: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
    { key: 'write', label: '写日记', icon: <PenLine className="size-4" /> },
    { key: 'history', label: '查看', icon: <CalendarDays className="size-4" /> },
    { key: 'search', label: '搜索', icon: <Search className="size-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Top header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="size-5 text-primary" />
            <h1 className="text-base font-medium">心流日记</h1>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Button
                key={item.key}
                variant={view === item.key ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setView(item.key)}
                className="rounded-xl gap-1.5"
              >
                {item.icon}
                {item.label}
              </Button>
            ))}
            <div className="w-px h-4 bg-border mx-1" />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowSettings(true)}
              className="rounded-lg"
              title="数据管理"
            >
              <Settings className="size-4" />
            </Button>
          </nav>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowSettings(true)}
            className="md:hidden rounded-lg"
            title="数据管理"
          >
            <Settings className="size-4" />
          </Button>
        </div>
      </header>

      {/* Toast */}
      {(importMsg || shareMsg) && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-card border border-border shadow-lg text-sm fade-enter">
          {importMsg || shareMsg}
        </div>
      )}

      {/* PWA prompt (not shown in Capacitor) */}
      {showPWAPrompt && !isCapacitor() && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 fade-enter">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setShowPWAPrompt(false)}
          />
          <div className="relative bg-card rounded-2xl border border-border p-6 w-full max-w-xs shadow-xl text-center">
            <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <ExternalLink className="size-5 text-primary" />
            </div>
            <h3 className="text-base font-medium mb-2">需要在浏览器中打开</h3>
            <p className="text-sm text-muted-foreground mb-5">
              {pwaAction === 'import'
                ? '导入功能需要在浏览器中打开才能选择文件。'
                : '导出/分享功能需要在浏览器中打开才能保存文件。'}
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setShowPWAPrompt(false)}
                className="rounded-xl flex-1"
              >
                取消
              </Button>
              <Button
                variant="default"
                onClick={handleOpenInBrowser}
                className="rounded-xl flex-1"
              >
                <ExternalLink className="size-3.5 mr-1" />
                在浏览器中打开
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Welcome guide (not shown in Capacitor) */}
      {showWelcome && !isCapacitor() && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 fade-enter">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => {
              localStorage.setItem('has-seen-welcome', 'true');
              setShowWelcome(false);
            }}
          />
          <div className="relative bg-card rounded-2xl border border-border p-6 w-full max-w-sm shadow-xl">
            <div className="text-center mb-5">
              <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="size-7 text-primary" />
              </div>
              <h2 className="text-lg font-medium mb-1">欢迎使用专注日记</h2>
              <p className="text-sm text-muted-foreground">专为 ADHD 人群设计的极简日记应用</p>
            </div>
            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                <PenLine className="size-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">快速记录</p>
                  <p className="text-xs text-muted-foreground">5 秒开始写日记，无压力</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                <Search className="size-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">情绪追踪</p>
                  <p className="text-xs text-muted-foreground">6 种情绪标签，可视化趋势</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                <Shield className="size-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">隐私优先</p>
                  <p className="text-xs text-muted-foreground">数据 100% 保存在本地，不上传云端</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  localStorage.setItem('has-seen-welcome', 'true');
                  setShowWelcome(false);
                  setShowPrivacy(true);
                }}
                className="rounded-xl flex-1"
              >
                了解更多
              </Button>
              <Button
                variant="default"
                onClick={() => {
                  localStorage.setItem('has-seen-welcome', 'true');
                  setShowWelcome(false);
                }}
                className="rounded-xl flex-1"
              >
                开始使用
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy modal */}
      {showPrivacy && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 fade-enter">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setShowPrivacy(false)}
          />
          <div className="relative bg-card rounded-2xl border border-border w-full max-w-sm shadow-xl flex flex-col max-h-[70vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <h2 className="text-base font-medium flex items-center gap-2">
                <Lock className="size-4 text-primary" />
                隐私说明
              </h2>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowPrivacy(false)}
                className="rounded-lg"
              >
                <X className="size-4" />
              </Button>
            </div>
            <div id="privacy-modal-content" className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
              <div className="text-center mb-4">
                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Shield className="size-5 text-primary" />
                </div>
                <h3 className="text-sm font-medium">你的数据完全由你掌控</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-green-600 shrink-0">✅</span>
                  <p className="text-muted-foreground">所有日记内容仅保存在你的浏览器本地存储中</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-600 shrink-0">✅</span>
                  <p className="text-muted-foreground">不会上传到任何服务器或云端</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-600 shrink-0">✅</span>
                  <p className="text-muted-foreground">我们不会收集、分析或共享你的任何数据</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-600 shrink-0">✅</span>
                  <p className="text-muted-foreground">清除浏览器数据会删除所有日记，请提前备份</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-600 shrink-0">✅</span>
                  <p className="text-muted-foreground">换设备时，使用「导出/导入」功能迁移数据</p>
                </div>
              </div>
              <div className="mt-5 p-3 rounded-xl bg-muted/50">
                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  本工具是纯前端应用，完全开源，代码可审计。
                  <br />
                  你的隐私安全是我们最重要的承诺。
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border shrink-0">
              <Button
                variant="default"
                onClick={() => setShowPrivacy(false)}
                className="rounded-xl w-full"
              >
                我知道了
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* iOS guide (not shown in Capacitor) */}
      {showIOSGuide && !isCapacitor() && (
        <div className="fixed inset-0 z-[2000] flex items-end justify-center p-4 fade-enter md:items-center">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setShowIOSGuide(false)}
          />
          <div className="relative bg-card rounded-2xl border border-border p-5 w-full max-w-sm shadow-xl mb-4 md:mb-0">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowIOSGuide(false)}
              className="absolute top-3 right-3 rounded-lg"
            >
              <X className="size-4" />
            </Button>
            <div className="text-center mb-4">
              <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <BookOpen className="size-5 text-primary" />
              </div>
              <h3 className="text-sm font-medium mb-1">添加到主屏幕</h3>
              <p className="text-xs text-muted-foreground">获得最佳体验，像 App 一样使用</p>
            </div>
            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/50">
                <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-medium text-primary">1</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  点击 Safari 底部分享按钮
                  <span className="inline-block mx-1 px-1.5 py-0.5 bg-background rounded text-[10px] border border-border">⬆️</span>
                </p>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/50">
                <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-medium text-primary">2</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  向下滚动，点击「添加到主屏幕」
                </p>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/50">
                <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-medium text-primary">3</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  点击右上角「添加」确认
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  localStorage.setItem('dismissed-ios-guide', 'true');
                  setShowIOSGuide(false);
                }}
                className="rounded-xl flex-1 text-xs"
              >
                不再提示
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowIOSGuide(false)}
                className="rounded-xl flex-1"
              >
                知道了
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Install prompt (not shown in Capacitor) */}
      {showInstallPrompt && !isPWAStandalone() && !isCapacitor() && (
        <div className="fixed inset-0 z-[2000] flex items-end justify-center p-4 fade-enter md:items-center">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => {
              localStorage.setItem('dismissed-install-prompt', 'true');
              setShowInstallPrompt(false);
            }}
          />
          <div className="relative bg-card rounded-2xl border border-border w-full max-w-sm shadow-xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12" y2="18" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-foreground">添加到主屏幕</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  将心流日记安装为应用，获得更好的使用体验：独立窗口、离线可用、快速启动。
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  localStorage.setItem('dismissed-install-prompt', 'true');
                  setShowInstallPrompt(false);
                }}
                className="rounded-xl flex-1 text-xs"
              >
                暂不安装
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleInstallPWA}
                className="rounded-xl flex-1"
              >
                安装应用
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 fade-enter">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setShowSettings(false)}
          />
          <div className="relative bg-card rounded-2xl border border-border w-full max-w-sm shadow-xl flex flex-col max-h-[66vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <h2 className="text-base font-medium">设置</h2>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowSettings(false)}
                className="rounded-lg"
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 space-y-3">
              {/* Theme mode */}
              <div className="rounded-xl border border-border p-4 space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  {isDark ? <Moon className="size-4 text-primary" /> : <Sun className="size-4 text-primary" />}
                  主题模式
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleThemeChange('auto')}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                      themeMode === 'auto'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <Monitor className="size-5" />
                    <span className="text-xs font-medium">自动</span>
                  </button>
                  <button
                    onClick={() => handleThemeChange('light')}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                      themeMode === 'light'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <Sun className="size-5" />
                    <span className="text-xs font-medium">浅色</span>
                  </button>
                  <button
                    onClick={() => handleThemeChange('dark')}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                      themeMode === 'dark'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <Moon className="size-5" />
                    <span className="text-xs font-medium">深色</span>
                  </button>
                </div>
                {themeMode === 'auto' && (
                  <p className="text-xs text-muted-foreground text-center">
                    23:30 - 07:30 自动切换深色模式
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-border p-4 space-y-2">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Share2 className="size-4 text-primary" />
                  分享日记
                </h3>
                <p className="text-xs text-muted-foreground">
                  将日记导出为 Markdown 格式，通过系统分享面板发送。
                </p>
                <Button
                  onClick={handleShare}
                  variant="secondary"
                  size="sm"
                  className="rounded-xl w-full"
                >
                  <Share2 className="size-3.5 mr-1" />
                  分享到...
                </Button>
              </div>

              <div className="rounded-xl border border-border p-4 space-y-2">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  导出 Markdown
                </h3>
                <p className="text-xs text-muted-foreground">
                  将日记导出为 Markdown 文件，方便阅读和导入其他工具。
                </p>
                <Button
                  onClick={handleExportMarkdown}
                  variant="secondary"
                  size="sm"
                  className="rounded-xl w-full"
                >
                  <FileText className="size-3.5 mr-1" />
                  导出 .md 文件
                </Button>
              </div>

              <div className="rounded-xl border border-border p-4 space-y-2">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Download className="size-4 text-primary" />
                  数据备份
                </h3>
                <p className="text-xs text-muted-foreground">
                  导出 JSON 格式完整备份（含对话记录），用于迁移到其他设备。
                </p>
                <Button
                  onClick={handleExport}
                  variant="secondary"
                  size="sm"
                  className="rounded-xl w-full"
                >
                  <Download className="size-3.5 mr-1" />
                  导出 JSON 备份
                </Button>
              </div>

              <div className="rounded-xl border border-border p-4 space-y-2">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Upload className="size-4 text-primary" />
                  导入数据
                </h3>
                <p className="text-xs text-muted-foreground">
                  从 JSON 备份文件恢复数据。导入时会自动合并，不会覆盖已有日记。
                </p>
                <Button
                  onClick={handleImport}
                  variant="secondary"
                  size="sm"
                  className="rounded-xl w-full"
                >
                  <Upload className="size-3.5 mr-1" />
                  选择备份文件
                </Button>
              </div>

              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">换手机迁移指南：</strong>
                  <br />
                  1. 在旧手机上点击「导出 JSON 备份」
                  <br />
                  2. 将生成的 JSON 文件发送到新手机
                  <br />
                  3. 在新手机打开本应用，点击「选择备份文件」导入
                  <br />
                  4. 完成！所有日记都会恢复
                </p>
              </div>

              {/* Storage usage */}
              <div className="rounded-xl border border-border p-4 space-y-2">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <HardDrive className="size-4 text-primary" />
                  存储用量
                </h3>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">已使用</span>
                    <span className="font-medium">{formatBytes(storageUsage.used)} / {formatBytes(storageUsage.total)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        storageUsage.percentage > 80 ? 'bg-red-400' : storageUsage.percentage > 60 ? 'bg-amber-400' : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(storageUsage.percentage, 100)}%` }}
                    />
                  </div>
                  {storageUsage.percentage > 80 && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <ChevronDown className="size-3" />
                      存储空间即将用尽，建议导出数据备份
                    </p>
                  )}
                </div>
              </div>

              {/* Privacy */}
              <div className="rounded-xl border border-border p-4 space-y-2">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Lock className="size-4 text-primary" />
                  隐私说明
                </h3>
                <p className="text-xs text-muted-foreground">
                  了解你的数据如何被保护和存储。
                </p>
                <Button
                  onClick={() => setShowPrivacy(true)}
                  variant="secondary"
                  size="sm"
                  className="rounded-xl w-full"
                >
                  <Shield className="size-3.5 mr-1" />
                  查看隐私政策
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-4 md:py-6">
        {/* Desktop layout */}
        <div className="hidden md:grid md:grid-cols-[280px_1fr] gap-6 h-[calc(100vh-7rem)]">
          <div className="flex flex-col gap-4 overflow-hidden">
            <div className="rounded-2xl border border-border bg-card shrink-0">
              <CalendarView selectedDate={selectedDate} onSelectDate={handleDateSelect} />
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="mb-2 px-1">
                <p className="text-sm font-medium text-muted-foreground">
                  {selectedDate === formatDate(new Date())
                    ? '今天'
                    : new Date(selectedDate).toLocaleDateString('zh-CN', {
                        month: 'long',
                        day: 'numeric',
                      })}
                  {' '}
                  <span className="text-xs">({dayEntries.length} 篇)</span>
                </p>
              </div>
              <JournalList entries={dayEntries} onEdit={handleEdit} onDelete={handleDelete} />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {view === 'write' && (
              <div className="h-full overflow-y-auto p-5 custom-scrollbar">
                <JournalEditor
                  onSave={handleSave}
                  initialContent={editingEntry?.content}
                  initialMood={editingEntry?.mood}
                  initialDate={editingEntry?.createdAt ? formatDate(new Date(editingEntry.createdAt)) : undefined}
                  editingId={editingEntry?.id}
                  onCancelEdit={handleCancelEdit}
                />
              </div>
            )}
            {view === 'history' && (
              <div className="h-full flex flex-col">
                <div className="p-3 border-b border-border">
                  <CalendarView selectedDate={selectedDate} onSelectDate={handleDateSelect} />
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  <JournalList entries={dayEntries} onEdit={handleEdit} onDelete={handleDelete} />
                </div>
              </div>
            )}
            {view === 'search' && <JournalSearch />}
          </div>
        </div>

        {/* Mobile layout */}
        <div className="md:hidden flex flex-col h-[calc(100vh-10rem)]">
          {view === 'write' && (
            <div className="flex-1 overflow-y-auto rounded-2xl border border-border bg-card p-4 custom-scrollbar">
              <JournalEditor
                onSave={handleSave}
                initialContent={editingEntry?.content}
                initialMood={editingEntry?.mood}
                initialDate={editingEntry?.createdAt ? formatDate(new Date(editingEntry.createdAt)) : undefined}
                editingId={editingEntry?.id}
                onCancelEdit={handleCancelEdit}
              />
            </div>
          )}

          {view === 'history' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex gap-1 mb-3">
                <Button
                  variant={mobilePanel === 'calendar' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setMobilePanel('calendar')}
                  className="rounded-xl flex-1"
                >
                  <CalendarDays className="size-3.5 mr-1" />
                  日历
                </Button>
                <Button
                  variant={mobilePanel === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setMobilePanel('list')}
                  className="rounded-xl flex-1"
                >
                  <BookOpen className="size-3.5 mr-1" />
                  日记 ({dayEntries.length})
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {mobilePanel === 'calendar' ? (
                  <div className="rounded-2xl border border-border bg-card">
                    <CalendarView selectedDate={selectedDate} onSelectDate={handleDateSelect} />
                  </div>
                ) : (
                  <JournalList entries={dayEntries} onEdit={handleEdit} onDelete={handleDelete} />
                )}
              </div>
            </div>
          )}

          {view === 'search' && (
            <div className="flex-1 rounded-2xl border border-border bg-card overflow-hidden">
              <JournalSearch />
            </div>
          )}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden sticky bottom-0 bg-background/80 backdrop-blur-sm border-t border-border">
        <div className="flex items-center justify-around h-14">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-colors duration-200 ${
                view === item.key ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {item.icon}
              <span className="text-[10px]">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
