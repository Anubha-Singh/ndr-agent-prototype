import { useCallback, useEffect, useMemo, useState } from 'react';
import { Boxes, FileJson2, ListFilter, Menu, RotateCcw, X } from 'lucide-react';
import { NdrQueueTable, type QueueFilter } from './components/NdrQueueTable';
import { PayloadInspector } from './components/PayloadInspector';
import { SimulationPanel } from './components/SimulationPanel';
import type { AuditEvent, NdrRecord } from './types/ndr';

type ActiveSection = 'queue' | 'payloads';

const DEFAULT_WHATSAPP_REPLY = 'No I am out of town till Friday leave it with the guard';

export default function App() {
  const [records, setRecords] = useState<NdrRecord[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggeringWebhook, setIsTriggeringWebhook] = useState(false);
  const [isParsingReply, setIsParsingReply] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<ActiveSection>('queue');
  const [statusFilter, setStatusFilter] = useState<QueueFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAwb, setSelectedAwb] = useState<string>('DLV50219');
  const [selectedRowAwb, setSelectedRowAwb] = useState<string | null>(null);
  const [highlightedAwb, setHighlightedAwb] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<string>(DEFAULT_WHATSAPP_REPLY);
  const [latestRecoveryPrompt, setLatestRecoveryPrompt] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/ndr');
      const data = (await response.json()) as {
        records?: NdrRecord[];
        auditEvents?: AuditEvent[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load Live NDR Queue.');
      }
      const loadedRecords = data.records ?? [];
      setRecords(loadedRecords);
      setAuditEvents(data.auditEvents ?? []);

      const firstActionable = loadedRecords.find((r) => r.status === 'Action Required 🟡');
      if (firstActionable) {
        setSelectedAwb(firstActionable.awb);
      } else if (loadedRecords.length > 0) {
        setSelectedAwb(loadedRecords[0].awb);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to connect to operations server.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  const handleTriggerWebhook = async () => {
    setErrorMessage(null);
    setIsTriggeringWebhook(true);
    try {
      const response = await fetch('/api/webhook/delivery-failure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          awb: 'DEL12345',
          customer_name: 'Rohan Kapoor',
          reason_code: 'Customer Unavailable',
        }),
      });
      const data = (await response.json()) as {
        generated_whatsapp_text?: string;
        record?: NdrRecord;
        records?: NdrRecord[];
        auditEvents?: AuditEvent[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || 'Failed to ingest delivery failure webhook.');
      }
      if (data.records) setRecords(data.records);
      if (data.auditEvents) setAuditEvents(data.auditEvents);
      setLatestRecoveryPrompt(
        data.generated_whatsapp_text ?? data.record?.recoveryPrompt ?? null
      );

      setSelectedAwb('DEL12345');
      setHighlightedAwb('DEL12345');
      setSelectedRowAwb('DEL12345');
      setStatusFilter('all');
      setActiveSection('queue');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Webhook ingestion failed.'
      );
    } finally {
      setIsTriggeringWebhook(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedAwb || !replyText.trim()) return;
    setErrorMessage(null);
    setIsParsingReply(true);
    try {
      const response = await fetch('/api/parse-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          awb: selectedAwb,
          customer_reply: replyText.trim(),
        }),
      });
      const data = (await response.json()) as {
        record?: NdrRecord;
        records?: NdrRecord[];
        auditEvents?: AuditEvent[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse customer reply via Gemini.');
      }
      if (data.records) setRecords(data.records);
      if (data.auditEvents) setAuditEvents(data.auditEvents);
      setHighlightedAwb(selectedAwb);
      setSelectedRowAwb(selectedAwb);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to parse reply with Gemini.'
      );
    } finally {
      setIsParsingReply(false);
    }
  };

  const handleResetQueue = async () => {
    setErrorMessage(null);
    setIsResetting(true);
    try {
      const response = await fetch('/api/ndr/reset', { method: 'POST' });
      const data = (await response.json()) as {
        records?: NdrRecord[];
        auditEvents?: AuditEvent[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset queue.');
      }
      const nextRecords = data.records ?? [];
      setRecords(nextRecords);
      setAuditEvents(data.auditEvents ?? []);
      setReplyText(DEFAULT_WHATSAPP_REPLY);
      setLatestRecoveryPrompt(null);
      setHighlightedAwb(null);
      setSelectedRowAwb(null);
      setStatusFilter('all');
      const firstActionable = nextRecords.find((r) => r.status === 'Action Required 🟡');
      if (firstActionable) {
        setSelectedAwb(firstActionable.awb);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to reset simulation.'
      );
    } finally {
      setIsResetting(false);
    }
  };

  const metrics = useMemo(() => {
    const total = records.length;
    const actionRequired = records.filter((r) => r.status === 'Action Required 🟡').length;
    const scheduled = records.filter((r) => r.status === 'Re-attempt Scheduled 🟢').length;
    const parsedCount = records.filter((r) => r.parsedInstructions !== null).length;
    return { total, actionRequired, scheduled, parsedCount };
  }, [records]);

  const hasTriggeredDel12345 = records.some((r) => r.awb === 'DEL12345');

  const handleSelectRow = (awb: string) => {
    setSelectedRowAwb((prev) => (prev === awb ? null : awb));
    setSelectedAwb(awb);
  };

  return (
    <div className="flex min-h-screen bg-[#090D16] text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col justify-between border-r border-slate-800/80 bg-[#0B101B] lg:flex">
        <div>
          <div className="flex h-14 items-center border-b border-slate-800/80 px-5">
            <a
              href="/"
              className="font-display text-base font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
            >
              CargoPulse
            </a>
          </div>

          <nav aria-label="Control Tower Navigation" className="space-y-1 p-3">
            <button
              type="button"
              onClick={() => {
                setActiveSection('queue');
                setStatusFilter('all');
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors duration-150 ${
                activeSection === 'queue' && statusFilter === 'all'
                  ? 'bg-slate-800/80 text-slate-100'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <Boxes className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">Live NDR Queue</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveSection('queue');
                setStatusFilter('action_required');
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors duration-150 ${
                activeSection === 'queue' && statusFilter === 'action_required'
                  ? 'bg-slate-800/80 text-slate-100'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center gap-2.5 whitespace-nowrap">
                <ListFilter className="h-4 w-4 shrink-0" />
                <span>Action Required</span>
              </span>
              <span className="font-mono text-xs text-amber-300 tabular-nums">
                {metrics.actionRequired}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('payloads')}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors duration-150 ${
                activeSection === 'payloads'
                  ? 'bg-slate-800/80 text-slate-100'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center gap-2.5 whitespace-nowrap">
                <FileJson2 className="h-4 w-4 shrink-0" />
                <span>Payload Inspector</span>
              </span>
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                {auditEvents.length}
              </span>
            </button>
          </nav>
        </div>

        <div className="border-t border-slate-800/80 p-3">
          <button
            type="button"
            onClick={handleResetQueue}
            disabled={isResetting}
            className="flex w-full items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-slate-800 bg-[#090D16] px-3 py-2 text-xs font-medium text-slate-300 transition-colors duration-150 hover:bg-slate-800/70 hover:text-slate-100 disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Simulation</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar Contract: Breadcrumb on left, 1 primary utility action on right */}
        <header className="flex h-14 items-center justify-between gap-8 border-b border-slate-800/80 bg-[#0B101B] px-5 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 lg:hidden"
            >
              {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <div className="flex items-center gap-2 truncate text-xs text-slate-400">
              <span className="hidden sm:inline">Operations</span>
              <span aria-hidden="true" className="hidden sm:inline text-slate-600">
                /
              </span>
              <span className="hidden sm:inline">Control Tower</span>
              <span aria-hidden="true" className="hidden sm:inline text-slate-600">
                /
              </span>
              <span className="font-medium text-slate-100">
                {activeSection === 'queue' ? 'Live NDR Queue' : 'Payload Inspector'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleResetQueue}
              disabled={isResetting}
              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-700/80 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors duration-150 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Queue</span>
            </button>
          </div>
        </header>

        {/* Mobile Drawer Nav */}
        {mobileNavOpen && (
          <div className="border-b border-slate-800/80 bg-[#0B101B] px-5 py-3 lg:hidden">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveSection('queue');
                  setStatusFilter('all');
                  setMobileNavOpen(false);
                }}
                className="whitespace-nowrap rounded-md border border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200"
              >
                Live NDR Queue
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveSection('queue');
                  setStatusFilter('action_required');
                  setMobileNavOpen(false);
                }}
                className="whitespace-nowrap rounded-md border border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200"
              >
                Action Required ({metrics.actionRequired})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveSection('payloads');
                  setMobileNavOpen(false);
                }}
                className="whitespace-nowrap rounded-md border border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200"
              >
                Payload Inspector ({auditEvents.length})
              </button>
            </div>
          </div>
        )}

        {/* Workspace Viewport */}
        <main className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col gap-6 px-5 py-6 lg:px-8">
          {/* Page Title & Live KPI Summary Strip */}
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
                Delivery Exception Control Tower
              </h1>
              <p className="text-sm text-slate-400">
                Monitor non-delivery reports, ingest courier webhooks, and convert customer replies into re-attempt instructions.
              </p>
            </div>

            <div className="grid grid-cols-2 divide-y divide-slate-800/80 overflow-hidden rounded-xl border border-slate-800/80 bg-[#0F1623] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
              <div className="px-5 py-3.5">
                <p className="text-xs text-slate-400">Active Queue</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-slate-100 tabular-nums">
                  {metrics.total}
                </p>
              </div>
              <div className="px-5 py-3.5">
                <p className="text-xs text-slate-400">Action Required</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-amber-300 tabular-nums">
                  {metrics.actionRequired}
                </p>
              </div>
              <div className="px-5 py-3.5">
                <p className="text-xs text-slate-400">Re-attempt Scheduled</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-emerald-300 tabular-nums">
                  {metrics.scheduled}
                </p>
              </div>
              <div className="px-5 py-3.5">
                <p className="text-xs text-slate-400">NLP Extracted</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-blue-300 tabular-nums">
                  {metrics.parsedCount}
                </p>
              </div>
            </div>
          </div>

          {/* 2-Step Simulation Panel */}
          <SimulationPanel
            records={records}
            selectedAwb={selectedAwb}
            onSelectAwb={setSelectedAwb}
            replyText={replyText}
            onReplyTextChange={setReplyText}
            onTriggerWebhook={handleTriggerWebhook}
            onSendReply={handleSendReply}
            isTriggeringWebhook={isTriggeringWebhook}
            isParsingReply={isParsingReply}
            hasTriggeredDel12345={hasTriggeredDel12345}
            latestRecoveryPrompt={latestRecoveryPrompt}
            errorMessage={errorMessage}
            onDismissError={() => setErrorMessage(null)}
          />

          {/* Primary Content Section */}
          {activeSection === 'queue' ? (
            <NdrQueueTable
              records={records}
              isLoading={isLoading}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              selectedRowAwb={selectedRowAwb}
              onSelectRow={handleSelectRow}
              highlightedAwb={highlightedAwb}
            />
          ) : (
            <PayloadInspector events={auditEvents} />
          )}
        </main>
      </div>
    </div>
  );
}
