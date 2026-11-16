import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AuditEvent,
  NdrIntent,
  NdrRecord,
  ParsedInstruction,
  ParsedIntelligence,
} from './src/types/ndr.ts';

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
      recoveryPrompt:
        'Hi Vikramaditya Rao, your BlueDart delivery (BDX88412) missed delivery due to Consignee Gate Locked. When can we reattempt or where should we leave it?',
      rawReply: 'Security cabin is open after 6pm today, please drop it there.',
      parsedIntelligence: {
        intent: 'Alternate_Instruction',
        new_date: 'Today (After 6 PM)',
        special_instructions: 'Leave at security cabin',
      },
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
      recoveryPrompt:
        'Hi Ananya Deshmukh, we attempted your Delhivery package (DLV50219) today but your phone was unreachable. Reply with a preferred time or instructions.',
      rawReply: null,
      parsedIntelligence: null,
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
      recoveryPrompt:
        'Hi Kabir Malhotra, your XpressBees shipment (XPR39104) paused due to Address Incomplete. Please share your flat/tower number and preferred slot.',
      rawReply: 'Tower B, Flat 1402. Reattempt tomorrow morning before 11.',
      parsedIntelligence: {
        intent: 'Reschedule',
        new_date: 'Tomorrow (Before 11 AM)',
        special_instructions: 'Deliver to Tower B 1402',
      },
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
      recoveryPrompt:
        'Hi Meera Nair, your Shadowfax order (SFX77301) is on hold per your reschedule request. Reply with the day and delivery instructions that work best.',
      rawReply: null,
      parsedIntelligence: null,
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

async function draftRecoveryMessageWithGemini(
  customerName: string,
  reasonCode: string
): Promise<string> {
  const fallbackMessage = `Hi ${customerName}, your delivery failed today due to ${reasonCode}. Shall we reattempt delivery tomorrow? Reply YES or update your address.`;

  if (!process.env.GEMINI_API_KEY) {
    return fallbackMessage;
  }

  try {
    const ai = getGenAIClient();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Recovery draft timeout')), 4500)
    );

    const response = await Promise.race([
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `A delivery failed for customer ${customerName}. Reason: ${reasonCode}. Draft a polite, concise, localized WhatsApp recovery message under 40 words.`,
        config: {
          systemInstruction:
            'You are an autonomous AI logistics recovery agent. Return only the plain-text WhatsApp recovery message under 40 words, without markdown or quotes.',
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      }),
      timeoutPromise,
    ]);

    const text = (response.text ?? '').trim();
    return text || fallbackMessage;
  } catch (error) {
    console.warn('Recovery prompt fallback triggered:', error instanceof Error ? error.message : error);
    return fallbackMessage;
  }
}

async function parseReplyWithGemini(rawReply: string): Promise<{
  parsedIntelligence: ParsedIntelligence;
  parsedInstructions: ParsedInstruction;
}> {
  const ai = getGenAIClient();
  const maxAttempts = 2;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Customer Reply: '${rawReply}'`,
        config: {
          systemInstruction:
            "You are a logistics NLP parser. A customer replied to a missed delivery text. Extract the intent and structured re-attempt fields. 'intent' must be one of 'Reschedule', 'Return_To_Origin', or 'Alternate_Instruction'. 'new_date' must extract the day/date if mentioned (e.g. 'Friday'), else null. 'special_instructions' must extract any specific delivery directions in 2 to 5 words with sentence-case capitalization (e.g. 'Leave with guard'), else null.",
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent: {
                type: Type.STRING,
                enum: ['Reschedule', 'Return_To_Origin', 'Alternate_Instruction'],
                description: 'Must be Reschedule, Return_To_Origin, or Alternate_Instruction.',
              },
              new_date: {
                type: Type.STRING,
                nullable: true,
                description: "Target day or date if mentioned (e.g. 'Friday'), else null.",
              },
              special_instructions: {
                type: Type.STRING,
                nullable: true,
                description: "Concise delivery directions (e.g. 'Leave with guard'), else null.",
              },
            },
            required: ['intent', 'new_date', 'special_instructions'],
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

      const parsed = JSON.parse(text) as {
        intent?: string;
        new_date?: string | null;
        special_instructions?: string | null;
      };

      const validIntents: NdrIntent[] = [
        'Reschedule',
        'Return_To_Origin',
        'Alternate_Instruction',
      ];
      const intent: NdrIntent = validIntents.includes(parsed.intent as NdrIntent)
        ? (parsed.intent as NdrIntent)
        : 'Alternate_Instruction';

      const newDate = parsed.new_date ? parsed.new_date.trim() : null;
      const specialInstructions = parsed.special_instructions
        ? parsed.special_instructions.trim()
        : null;

      const parsedIntelligence: ParsedIntelligence = {
        intent,
        new_date: newDate,
        special_instructions: specialInstructions,
      };

      const parsedInstructions: ParsedInstruction = {
        Date: newDate ?? 'Next Business Day',
        Instruction: specialInstructions ?? intent.replace(/_/g, ' '),
      };

      return { parsedIntelligence, parsedInstructions };
    } catch (error) {
      lastError = error;
      const errText = error instanceof Error ? error.message : String(error);
      if (errText.includes('429') || errText.includes('RESOURCE_EXHAUSTED')) {
        throw new Error(
          'Gemini API rate limit reached (5 requests/min on free tier). Please wait a few seconds and retry, or upgrade your API key quota in Settings > Secrets.'
        );
      }
      const isTransient503 = errText.includes('503') || errText.includes('UNAVAILABLE');
      if (!isTransient503 || attempt === maxAttempts) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 700));
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

  const handleWebhookIngest = async (req: express.Request, res: express.Response) => {
    const requestedAwb =
      typeof req.body?.awb === 'string' && req.body.awb.trim()
        ? req.body.awb.trim()
        : 'DEL12345';
    const customerName =
      typeof req.body?.customer_name === 'string' && req.body.customer_name.trim()
        ? req.body.customer_name.trim()
        : 'Rohan Kapoor';
    const reasonCode =
      typeof req.body?.reason_code === 'string' && req.body.reason_code.trim()
        ? req.body.reason_code.trim()
        : 'Customer Unavailable';

    const generatedWhatsappText = await draftRecoveryMessageWithGemini(
      customerName,
      reasonCode
    );

    const existingIndex = ndrRecords.findIndex((item) => item.awb === requestedAwb);

    const newRecord: NdrRecord = {
      id: existingIndex >= 0 ? ndrRecords[existingIndex].id : `ndr-${Date.now()}`,
      awb: requestedAwb,
      customer: customerName,
      phone: '+91 98450 61209',
      courier: 'Delhivery Express',
      hub: 'DEL-NCR-01',
      failureReason: reasonCode,
      recoveryPrompt: generatedWhatsappText,
      rawReply: null,
      parsedIntelligence: null,
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
      summary: `NDR Agent processed ${newRecord.awb} (${newRecord.failureReason}) and sent WhatsApp recovery prompt`,
      payload: {
        status: 'success',
        message: 'NDR Agent successfully processed event',
        awb: newRecord.awb,
        generated_whatsapp_text: generatedWhatsappText,
        action_taken: 'Sent automated recovery prompt to customer',
      },
    };
    auditEvents.unshift(event);

    res.status(200).json({
      status: 'success',
      message: 'NDR Agent successfully processed event',
      awb: newRecord.awb,
      generated_whatsapp_text: generatedWhatsappText,
      action_taken: 'Sent automated recovery prompt to customer',
      record: newRecord,
      records: ndrRecords,
      auditEvents,
    });
  };

  app.post('/api/webhook/delivery-failure', handleWebhookIngest);
  app.post('/api/webhook', handleWebhookIngest);

  app.post('/api/parse-reply', async (req, res) => {
    const awb = typeof req.body?.awb === 'string' ? req.body.awb.trim() : '';
    const rawReplyInput =
      typeof req.body?.customer_reply === 'string'
        ? req.body.customer_reply
        : typeof req.body?.rawReply === 'string'
          ? req.body.rawReply
          : '';
    const customerReply = rawReplyInput.trim();

    if (!awb || !customerReply) {
      res.status(400).json({
        status: 'error',
        error: 'Both awb and customer_reply are required.',
      });
      return;
    }

    const targetIndex = ndrRecords.findIndex((item) => item.awb === awb);
    if (targetIndex === -1) {
      res.status(404).json({
        status: 'error',
        error: `Shipment ${awb} was not found in the Live NDR Queue.`,
      });
      return;
    }

    try {
      const { parsedIntelligence, parsedInstructions } =
        await parseReplyWithGemini(customerReply);

      const newQueueStatus = 'Re-attempt Scheduled 🟢' as const;

      const updatedRecord: NdrRecord = {
        ...ndrRecords[targetIndex],
        rawReply: customerReply,
        parsedIntelligence,
        parsedInstructions,
        status: newQueueStatus,
        updatedAt: formatTime(),
      };

      ndrRecords[targetIndex] = updatedRecord;

      const event: AuditEvent = {
        id: `evt-${Date.now()}`,
        timestamp: formatTime(),
        type: 'GEMINI_NLP_PARSED',
        awb: updatedRecord.awb,
        summary: `Parsed ${parsedIntelligence.intent} · {Date: ${parsedInstructions.Date}, Instruction: ${parsedInstructions.Instruction}}`,
        payload: {
          status: 'success',
          message: 'Customer reply parsed and mock DB updated',
          awb: updatedRecord.awb,
          parsed_intelligence: parsedIntelligence,
          new_queue_status: newQueueStatus,
        },
      };
      auditEvents.unshift(event);

      res.json({
        status: 'success',
        message: 'Customer reply parsed and mock DB updated',
        awb: updatedRecord.awb,
        parsed_intelligence: parsedIntelligence,
        new_queue_status: newQueueStatus,
        record: updatedRecord,
        records: ndrRecords,
        auditEvents,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to parse customer reply with Gemini.';
      console.error('Gemini parse-reply error:', error);
      res.status(502).json({ status: 'error', error: message });
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
