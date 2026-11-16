import { Search, X } from 'lucide-react';
import type { NdrRecord } from '../types/ndr';

export type QueueFilter = 'all' | 'action_required' | 'scheduled';

interface NdrQueueTableProps {
  records: NdrRecord[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: QueueFilter;
  onStatusFilterChange: (filter: QueueFilter) => void;
  selectedRowAwb: string | null;
  onSelectRow: (awb: string) => void;
  highlightedAwb: string | null;
}

export function NdrQueueTable({
  records,
  isLoading,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  selectedRowAwb,
  onSelectRow,
  highlightedAwb,
}: NdrQueueTableProps) {
  const filteredRecords = records.filter((record) => {
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'action_required' && record.status === 'Action Required 🟡') ||
      (statusFilter === 'scheduled' && record.status === 'Re-attempt Scheduled 🟢');

    if (!matchesStatus) return false;

    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    return (
      record.awb.toLowerCase().includes(query) ||
      record.customer.toLowerCase().includes(query) ||
      record.courier.toLowerCase().includes(query) ||
      record.failureReason.toLowerCase().includes(query)
    );
  });

  const inspectedRecord = records.find((r) => r.awb === selectedRowAwb) ?? null;

  return (
    <section
      aria-label="Live NDR Queue"
      className="overflow-hidden rounded-xl border border-slate-800/80 bg-[#0F1623]"
    >
      {/* Table Header & Controls */}
      <div className="flex flex-col gap-3 border-b border-slate-800/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-100">
            Live NDR Queue
          </h2>
          <p className="text-xs text-slate-400">
            Real-time non-delivery exceptions and structured re-attempt instructions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Segmented Filter Control */}
          <div
            role="tablist"
            aria-label="Filter queue by status"
            className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#090D16] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'all'}
              onClick={() => onStatusFilterChange('all')}
              className={`whitespace-nowrap shrink-0 rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                statusFilter === 'all'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({records.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'action_required'}
              onClick={() => onStatusFilterChange('action_required')}
              className={`whitespace-nowrap shrink-0 rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                statusFilter === 'action_required'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Action Required
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'scheduled'}
              onClick={() => onStatusFilterChange('scheduled')}
              className={`whitespace-nowrap shrink-0 rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                statusFilter === 'scheduled'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Scheduled
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search AWB or customer..."
              aria-label="Search Live NDR Queue"
              className="w-56 rounded-lg border border-slate-800 bg-[#090D16] py-1.5 pl-8 pr-3 text-xs text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Data Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-800/80 bg-[#0B111C] text-xs font-medium text-slate-400">
              <th scope="col" className="whitespace-nowrap px-5 py-3">
                AWB
              </th>
              <th scope="col" className="whitespace-nowrap px-4 py-3">
                Customer
              </th>
              <th scope="col" className="whitespace-nowrap px-4 py-3">
                Courier
              </th>
              <th scope="col" className="whitespace-nowrap px-4 py-3">
                Failure Reason
              </th>
              <th scope="col" className="whitespace-nowrap px-4 py-3">
                NLP Parsed Instructions
              </th>
              <th scope="col" className="whitespace-nowrap px-5 py-3 text-right">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 text-sm">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <tr key={index} className="animate-pulse">
                  <td className="px-5 py-3.5">
                    <div className="h-4 w-20 rounded bg-slate-800" />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="h-4 w-32 rounded bg-slate-800" />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="h-4 w-28 rounded bg-slate-800" />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="h-4 w-36 rounded bg-slate-800" />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="h-5 w-48 rounded bg-slate-800" />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="ml-auto h-4 w-28 rounded bg-slate-800" />
                  </td>
                </tr>
              ))
            ) : filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center">
                  <p className="text-sm font-medium text-slate-300">
                    No matching exceptions in the Live NDR Queue
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Clear your search filter or trigger a delivery failure webhook to ingest a new shipment.
                  </p>
                </td>
              </tr>
            ) : (
              filteredRecords.map((record) => {
                const isSelected = selectedRowAwb === record.awb;
                const isHighlighted = highlightedAwb === record.awb;
                const isActionRequired = record.status === 'Action Required 🟡';

                return (
                  <tr
                    key={record.awb}
                    onClick={() => onSelectRow(record.awb)}
                    className={`cursor-pointer transition-colors duration-150 ${
                      isSelected
                        ? 'bg-blue-950/25'
                        : isHighlighted
                          ? 'bg-slate-800/50'
                          : 'hover:bg-slate-800/35'
                    }`}
                  >
                    <td className="whitespace-nowrap px-5 py-3.5 align-middle">
                      <div className="font-mono text-xs font-semibold tracking-wide text-slate-100 tabular-nums">
                        {record.awb}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500 tabular-nums">
                        {record.hub} · {record.updatedAt}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3.5 align-middle">
                      <div className="font-medium text-slate-200">{record.customer}</div>
                      <div className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums">
                        {record.phone}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3.5 align-middle text-xs text-slate-300">
                      {record.courier}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3.5 align-middle text-xs text-slate-300">
                      {record.failureReason}
                    </td>

                    <td className="px-4 py-3.5 align-middle">
                      {record.parsedInstructions ? (
                        <div className="space-y-1">
                          {record.parsedIntelligence && (
                            <div className="text-xs text-slate-400">
                              <span>Intent: </span>
                              <span className="font-mono text-slate-200">
                                {record.parsedIntelligence.intent}
                              </span>
                            </div>
                          )}
                          <code className="inline-block whitespace-nowrap rounded-md border border-emerald-500/30 bg-[#090D16] px-2.5 py-1 font-mono text-xs text-emerald-300">
                            {`{Date: ${record.parsedInstructions.Date}, Instruction: ${record.parsedInstructions.Instruction}}`}
                          </code>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">
                          Awaiting customer reply
                        </span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-3.5 text-right align-middle">
                      <span
                        className={`text-xs font-medium ${
                          isActionRequired ? 'text-amber-300' : 'text-emerald-300'
                        }`}
                      >
                        {record.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Selected Row Detail Strip */}
      {inspectedRecord && (
        <div className="border-t border-slate-800/80 bg-[#0B111C] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 text-xs">
              <div className="flex flex-wrap items-center gap-2 text-slate-400">
                <span>Selected Shipment</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono font-semibold text-slate-200">
                  {inspectedRecord.awb}
                </span>
                <span aria-hidden="true">·</span>
                <span>{inspectedRecord.customer}</span>
              </div>

              {inspectedRecord.recoveryPrompt && (
                <p className="text-slate-300">
                  <span className="text-slate-500">Automated Recovery Prompt: </span>
                  <span className="text-slate-300">&ldquo;{inspectedRecord.recoveryPrompt}&rdquo;</span>
                </p>
              )}

              <p className="text-slate-300">
                <span className="text-slate-500">Customer WhatsApp Reply: </span>
                {inspectedRecord.rawReply ? (
                  <span className="italic text-slate-200">&ldquo;{inspectedRecord.rawReply}&rdquo;</span>
                ) : (
                  <span className="text-slate-500">No customer reply received yet.</span>
                )}
              </p>

              {inspectedRecord.parsedIntelligence && (
                <p className="font-mono text-slate-400">
                  parsed_intelligence:{' '}
                  <span className="text-emerald-300">
                    {JSON.stringify(inspectedRecord.parsedIntelligence)}
                  </span>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onSelectRow(inspectedRecord.awb)}
              aria-label="Close shipment details"
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
