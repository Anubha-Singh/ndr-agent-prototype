export type NdrStatus = 'Action Required 🟡' | 'Re-attempt Scheduled 🟢';

export type NdrIntent = 'Reschedule' | 'Return_To_Origin' | 'Alternate_Instruction';

export interface ParsedIntelligence {
  intent: NdrIntent;
  new_date: string | null;
  special_instructions: string | null;
}

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
  recoveryPrompt: string | null;
  rawReply: string | null;
  parsedIntelligence: ParsedIntelligence | null;
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
