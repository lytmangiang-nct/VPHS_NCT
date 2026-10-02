import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { RecordViolationForm } from './components/RecordViolationForm.tsx';
import { ViolationLogView } from './components/ViolationLogView.tsx';
import { User, AppConfig } from './types/index.ts';
import { getStoredUser, api } from './services/api.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('record');
  const [currentUser] = useState<User>(() => getStoredUser());
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [config, setConfig] = useState<(AppConfig & { isWebhookConfigured: boolean; isSheetConfigured: boolean }) | null>(null);

  const fetchConfig = () => {
    api.getConfig().then(setConfig).catch(() => {});
  };

  useEffect(() => {
    fetchConfig();

    const handleFocus = () => {
      fetchConfig();
      setRefreshKey((prev) => prev + 1);
    };
    window.addEventListener('focus', handleFocus);

    // Auto-sync every 8 seconds so entries from phone appear on PC automatically
    const interval = setInterval(() => {
      setRefreshKey((prev) => prev + 1);
    }, 8000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, []);

  const handleViolationRecorded = (violationId: string) => {
    setHighlightId(violationId);
    setRefreshKey((prev) => prev + 1);
    setActiveTab('log');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800 font-sans antialiased selection:bg-blue-600 selection:text-white w-full">
      {/* Header spanning 100% full width */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setHighlightId(null);
          setActiveTab(tab);
        }}
        config={config}
        onRefresh={() => {
          fetchConfig();
          setRefreshKey((prev) => prev + 1);
        }}
      />

      {/* Main Content Area - Only 1 tab shown at a time */}
      <main className="flex-1 w-full pb-8">
        <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4">
          {activeTab === 'record' ? (
            <div className="max-w-3xl mx-auto">
              <RecordViolationForm
                currentUser={currentUser}
                onSuccessNavigate={handleViolationRecorded}
              />
            </div>
          ) : (
            <ViolationLogView
              key={refreshKey}
              currentUser={currentUser}
              highlightId={highlightId}
            />
          )}
        </div>
      </main>

      {/* Full-width Responsive Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 px-3 sm:px-6 lg:px-8 text-center text-xs text-slate-500 w-full">
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-1.5">
          <span className="font-medium text-slate-700">
            Sổ ghi nhận vi phạm &bull; Gửi toàn bộ trường dữ liệu qua Webhook & Google Sheets
          </span>
          <span className="font-mono text-[11px] text-slate-400">Múi giờ Asia/Ho_Chi_Minh (+07:00)</span>
        </div>
      </footer>
    </div>
  );
}
