import { AlertCircle, ArrowRight, Loader2, MessageSquareText, Webhook } from 'lucide-react';
import type { NdrRecord } from '../types/ndr';

interface SimulationPanelProps {
  records: NdrRecord[];
  selectedAwb: string;
  onSelectAwb: (awb: string) => void;
  replyText: string;
  onReplyTextChange: (value: string) => void;
  onTriggerWebhook: () => Promise<void>;
  onSendReply: () => Promise<void>;
  isTriggeringWebhook: boolean;
  isParsingReply: boolean;
  hasTriggeredDel12345: boolean;
  errorMessage: string | null;
  onDismissError: () => void;
}

export function SimulationPanel({
  records,
  selectedAwb,
  onSelectAwb,
  replyText,
  onReplyTextChange,
  onTriggerWebhook,
  onSendReply,
  isTriggeringWebhook,
  isParsingReply,
  hasTriggeredDel12345,
  errorMessage,
  onDismissError,
}: SimulationPanelProps) {
  const actionableRecords = records.filter((r) => r.status === 'Action Required 🟡');
  const targetOptions = actionableRecords.length > 0 ? actionableRecords : records;

  return (
    <section
      aria-label="NDR Workflow Simulation"
      className="rounded-xl border border-slate-800/80 bg-[#0F1623]"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-slate-100">
            Exception Workflow Simulation
          </h2>
          <p className="text-xs text-slate-400">
            Ingest a carrier delivery failure webhook and parse unstructured WhatsApp replies via Gemini.
          </p>
        </div>
        <div className="text-xs text-slate-400 tabular-nums">
          <span>{actionableRecords.length} awaiting customer reply</span>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 border-b border-red-900/60 bg-red-950/30 px-5 py-2.5 text-xs text-red-300"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={onDismissError}
            className="whitespace-nowrap shrink-0 text-xs font-medium text-red-300 underline-offset-2 hover:text-red-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 divide-y divide-slate-800/80 lg:grid-cols-12 lg:divide-x lg:divide-y-0">
        {/* Step 1: Trigger Delivery Failure Webhook */}
        <div className="flex flex-col justify-between gap-4 p-5 lg:col-span-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <Webhook className="h-3.5 w-3.5 text-amber-400" />
              <span>01. Carrier Webhook Ingestion</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">
              Simulate a failed delivery event for shipment{' '}
              <span className="font-mono text-xs text-slate-100">DEL12345</span>{' '}
              <span className="text-slate-500">·</span>{' '}
              <span className="text-slate-300">Customer Unavailable</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onTriggerWebhook}
              disabled={isTriggeringWebhook}
              className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-300 transition-colors duration-150 hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isTriggeringWebhook ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Webhook className="h-3.5 w-3.5" />
              )}
              <span>Trigger Delivery Failure Webhook</span>
            </button>

            {hasTriggeredDel12345 && (
              <span className="text-xs text-slate-400">
                Row <span className="font-mono text-slate-200">DEL12345</span> active in queue
              </span>
            )}
          </div>
        </div>

        {/* Step 2: Simulate Customer WhatsApp Reply */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSendReply();
          }}
          className="flex flex-col justify-between gap-4 p-5 lg:col-span-7"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <MessageSquareText className="h-3.5 w-3.5 text-blue-400" />
              <span>02. WhatsApp Reply &amp; Gemini NLP Extraction</span>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="target-awb-select" className="text-xs text-slate-400">
                Target AWB
              </label>
              <select
                id="target-awb-select"
                value={selectedAwb}
                onChange={(e) => onSelectAwb(e.target.value)}
                className="rounded-md border border-slate-700/80 bg-[#090D16] px-2.5 py-1 font-mono text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {targetOptions.map((item) => (
                  <option key={item.awb} value={item.awb}>
                    {item.awb} — {item.customer}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="whatsapp-reply-input"
              className="block text-xs font-medium text-slate-300"
            >
              Simulate Customer WhatsApp Reply
            </label>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <input
                id="whatsapp-reply-input"
                type="text"
                value={replyText}
                onChange={(e) => onReplyTextChange(e.target.value)}
                placeholder="Enter customer WhatsApp reply..."
                className="w-full rounded-lg border border-slate-700/80 bg-[#090D16] px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
              <button
                type="submit"
                disabled={isParsingReply || !replyText.trim() || !selectedAwb}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isParsingReply ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Parsing Reply...</span>
                  </>
                ) : (
                  <>
                    <span>Send Reply</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
