import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { AuditEvent, NdrRecord, ParsedInstruction } from './src/types/ndr.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

function createInitialRecords(): NdrRecord[] {
  return [
    {
      id: 'ndr-101',
      awb: 'BDX88412',
      customer: 'Vikramaditya Rao',
      phone: '+91 98204 11892',
      courier: 'BlueDart Priority',
      hub: 'BLR-IND-04',
      failureReason: 'Consignee Gate Locked',
      rawReply: 'Security cabin is open after 6pm today, please drop it there.',
      parsedInstructions: {
        Date: 'Today (After 6 PM)',
        Instruction: 'Leave at security cabin',
      },
      status: 'Re-attempt Scheduled 🟢',
      updatedAt: '07:52 AM',
    },
    {
      id: 'ndr-102',
      awb: 'DLV50219',
      customer: 'Ananya Deshmukh',
      phone: '+91 98112 74503',
      courier: 'Delhivery Surface',
      hub: 'MUM-WST-02',
      failureReason: 'Phone Unreachable',
      rawReply: null,
      parsedInstructions: null,
      status: 'Action Required 🟡',
      updatedAt: '07:41 AM',
    },
    {
      id: 'ndr-103',
      awb: 'XPR39104',
      customer: 'Kabir Malhotra',
      phone: '+91 99100 58214',
      courier: 'XpressBees Air',
      hub: 'DEL-NCR-07',
      failureReason: 'Address Incomplete',
      rawReply: 'Tower B, Flat 1402. Reattempt tomorrow morning before 11.',
      parsedInstructions: {
        Date: 'Tomorrow (Before 11 AM)',
        Instruction: 'Deliver to Tower B 1402',
      },
      status: 'Re-attempt Scheduled 🟢',
      updatedAt: '07:18 AM',
    },
    {
      id: 'ndr-104',
      awb: 'SFX77301',
      customer: 'Meera Nair',
      phone: '+91 97450 29811',
      courier: 'Shadowfax Same-Day',
      hub: 'HYD-CEN-01',
      failureReason: 'Customer Requested Reschedule',
      rawReply: null,
      parsedInstructions: null,
      status: 'Action Required 🟡',
      updatedAt: '06:54 AM',
    },
  ];
}

let ndrRecords: NdrRecord[] = createInitialRecords();
let auditEvents: AuditEvent[] = [];

function formatTime(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function parseReplyWithGemini(rawReply: string): Promise<ParsedInstruction> {
  const ai = getGenAIClient();
  const maxAttempts = 3;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Customer WhatsApp reply: "${rawReply}"`,
        config: {
          systemInstruction:
            "You are a logistics NDR (Non-Delivery Report) operations parser. Extract structured delivery re-attempt instructions from a messy customer WhatsApp reply. Return concise JSON with 'Date' (the target day or timeframe mentioned, e.g. 'Friday', 'Tomorrow', 'Monday', or 'Next Business Day' if none mentioned) and 'Instruction' (a crisp imperative delivery instruction in 2 to 5 words with sentence-case capitalization, e.g. 'Leave with guard').",
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              Date: {
                type: Type.STRING,
                description: "The target delivery day or timeframe, e.g. 'Friday'.",
              },
              Instruction: {
                type: Type.STRING,
                description: "Concise delivery action in 2 to 5 words, e.g. 'Leave with guard'.",
              },
            },
            required: ['Date', 'Instruction'],
          },
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      const text = (response.text ?? '').trim();
      if (!text) {
        throw new Error('Gemini returned an empty response.');
      }

      const parsed = JSON.parse(text) as Partial<ParsedInstruction>;
      return {
        Date: (parsed.Date || 'Next Business Day').trim(),
        Instruction: (parsed.Instruction || 'Re-attempt delivery').trim(),
      };
    } catch (error) {
      lastError = error;
      const errText = error instanceof Error ? error.message : String(error);
      const isTransient = errText.includes('503') || errText.includes('429') || errText.includes('UNAVAILABLE');
      if (!isTransient || attempt === maxAttempts) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 600));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to parse reply with Gemini.');
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/ndr', (_req, res) => {
    res.json({
      records: ndrRecords,
      auditEvents,
    });
  });

  app.post('/api/webhook/delivery-failure', (req, res) => {
    const requestedAwb = typeof req.body?.awb === 'string' && req.body.awb.trim() ? req.body.awb.trim() : 'DEL12345';
    const existingIndex = ndrRecords.findIndex((item) => item.awb === requestedAwb);

    const newRecord: NdrRecord = {
      id: existingIndex >= 0 ? ndrRecords[existingIndex].id : `ndr-${Date.now()}`,
      awb: requestedAwb,
      customer: 'Rohan Kapoor',
      phone: '+91 98450 61209',
      courier: 'Delhivery Express',
      hub: 'DEL-NCR-01',
      failureReason: 'Customer Unavailable',
      rawReply: null,
      parsedInstructions: null,
      status: 'Action Required 🟡',
      updatedAt: formatTime(),
    };

    if (existingIndex >= 0) {
      ndrRecords.splice(existingIndex, 1);
    }
    ndrRecords.unshift(newRecord);

    const event: AuditEvent = {
      id: `evt-${Date.now()}`,
      timestamp: formatTime(),
      type: 'WEBHOOK_INGESTED',
      awb: newRecord.awb,
      summary: `Carrier webhook ingested for ${newRecord.awb} (${newRecord.failureReason})`,
      payload: {
        event: 'delivery.failed',
        awb: newRecord.awb,
        courier: newRecord.courier,
        reason: newRecord.failureReason,
        status: newRecord.status,
      },
    };
    auditEvents.unshift(event);

    res.status(201).json({
      record: newRecord,
      records: ndrRecords,
      auditEvents,
    });
  });

  app.post('/api/parse-reply', async (req, res) => {
    const awb = typeof req.body?.awb === 'string' ? req.body.awb.trim() : '';
    const rawReply = typeof req.body?.rawReply === 'string' ? req.body.rawReply.trim() : '';

    if (!awb || !rawReply) {
      res.status(400).json({ error: 'Both awb and rawReply are required.' });
      return;
    }

    const targetIndex = ndrRecords.findIndex((item) => item.awb === awb);
    if (targetIndex === -1) {
      res.status(404).json({ error: `Shipment ${awb} was not found in the Live NDR Queue.` });
      return;
    }

    try {
      const parsedInstructions = await parseReplyWithGemini(rawReply);

      const updatedRecord: NdrRecord = {
        ...ndrRecords[targetIndex],
        rawReply,
        parsedInstructions,
        status: 'Re-attempt Scheduled 🟢',
        updatedAt: formatTime(),
      };

      ndrRecords[targetIndex] = updatedRecord;

      const event: AuditEvent = {
        id: `evt-${Date.now()}`,
        timestamp: formatTime(),
        type: 'GEMINI_NLP_PARSED',
        awb: updatedRecord.awb,
        summary: `Gemini extracted {Date: ${parsedInstructions.Date}, Instruction: ${parsedInstructions.Instruction}}`,
        payload: {
          awb: updatedRecord.awb,
          rawReply,
          parsedInstructions,
          newStatus: updatedRecord.status,
        },
      };
      auditEvents.unshift(event);

      res.json({
        record: updatedRecord,
        records: ndrRecords,
        auditEvents,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to parse customer reply with Gemini.';
      console.error('Gemini parse-reply error:', error);
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/ndr/reset', (_req, res) => {
    ndrRecords = createInitialRecords();
    auditEvents = [
      {
        id: `evt-${Date.now()}`,
        timestamp: formatTime(),
        type: 'QUEUE_RESET',
        awb: 'SYSTEM',
        summary: 'Live NDR Queue reset to initial baseline',
        payload: { count: ndrRecords.length },
      },
    ];
    res.json({
      records: ndrRecords,
      auditEvents,
    });
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CargoPulse Control Tower running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
