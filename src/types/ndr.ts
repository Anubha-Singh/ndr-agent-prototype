export type NdrStatus = 'Action Required 🟡' | 'Re-attempt Scheduled 🟢';

export interface ParsedInstruction {
  Date: string;
  Instruction: string;
}

export interface NdrRecord {
  id: string;
  awb: string;
  customer: string;
  phone: string;
  courier: string;
  hub: string;
  failureReason: string;
  rawReply: string | null;
  parsedInstructions: ParsedInstruction | null;
  status: NdrStatus;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  type: 'WEBHOOK_INGESTED' | 'GEMINI_NLP_PARSED' | 'QUEUE_RESET';
  awb: string;
  summary: string;
  payload: unknown;
}
