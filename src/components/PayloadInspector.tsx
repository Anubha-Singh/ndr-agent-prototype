import type { AuditEvent } from '../types/ndr';

interface PayloadInspectorProps {
  events: AuditEvent[];
}

export function PayloadInspector({ events }: PayloadInspectorProps) {
  return (
    <section
      aria-label="Webhook and Gemini NLP Payload Inspector"
      className="overflow-hidden rounded-xl border border-slate-800/80 bg-[#0F1623]"
    >
      <div className="border-b border-slate-800/80 px-5 py-4">
        <h2 className="text-base font-semibold tracking-tight text-slate-100">
          Webhook &amp; Parser Audit Log
        </h2>
        <p className="text-xs text-slate-400">
          Real-time carrier webhook payloads and structured Gemini JSON extractions recorded in this session
        </p>
      </div>

      {events.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm font-medium text-slate-300">No simulation events recorded yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Trigger a delivery failure webhook or send a simulated WhatsApp reply to inspect the raw JSON payloads.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/70">
          {events.map((event) => (
            <div key={event.id} className="space-y-2.5 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-slate-200">{event.awb}</span>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <span
                    className={
                      event.type === 'GEMINI_NLP_PARSED'
                        ? 'text-emerald-300'
                        : event.type === 'WEBHOOK_INGESTED'
                          ? 'text-amber-300'
                          : 'text-slate-400'
                    }
                  >
                    {event.summary}
                  </span>
                </div>
                <span className="font-mono text-slate-500 tabular-nums">{event.timestamp}</span>
              </div>
              <pre className="overflow-x-auto rounded-lg border border-slate-800/80 bg-[#090D16] p-3 font-mono text-xs leading-relaxed text-slate-300">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
