import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { GoogleGenerativeAI, SchemaType, Schema } from '@google/generative-ai';
import { DailyLogger } from '../../common/daily-logger';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createWorker } = require('tesseract.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require('sharp');

export interface OcrResult {
  // Best-effort amount parsed out of the screenshot text (whole rupees).
  amount: number | null;
  // UTR / bank reference number, if we can find one.
  utr: string | null;
  // A UPI VPA found in the image text (corroboration; the caption is primary).
  upiId: string | null;
  // The full raw OCR text, kept for audit/debugging.
  text: string;

  // Additional fields at code level (not present in standard OcrResult but saved in DB extracted object)
  is_payment_screenshot?: boolean;
  payment_app?: string | null;
  status?: string;
  currency?: string | null;
  transaction_id?: string | null;
  reference_number?: string | null;
  payer_name?: string | null;
  payee_name?: string | null;
  date?: string | null;
  time?: string | null;
  confidence?: number;
}

const PROMPT_TEXT = `You are a UPI payment screenshot extraction engine.

Analyze the uploaded image and extract payment information from it.

IMPORTANT RULES:

- The image may be from PhonePe, Google Pay, Paytm, BHIM, another UPI app, or an unknown source.
- Do NOT assume the payment app before analyzing the image.
- Do NOT use fixed screen positions to identify fields.
- Different screenshots can have completely different layouts.
- Use the complete visual context, labels, surrounding text, symbols, and relationships between fields.
- Carefully distinguish the PAYMENT AMOUNT from UTR, transaction ID, reference number, phone number, account number, date, and time.
- The \`amount\` must represent the actual money amount paid or received.
- Never use a transaction ID, UTR, reference number, phone number, or account number as the amount.
- Never guess or invent values.
- If a field cannot be identified confidently, return null.
- If multiple numbers are present, determine their meaning using labels and visual context.

PAYMENT STATUS RULES (critical):

- You MUST read the payment status directly from the image text. Look for words like "Success", "Failed", "Pending", "Processing", "Declined", "Reversed", "Cancelled".
- If the image shows the payment as FAILED, DECLINED, REVERSED, or CANCELLED — set \`status\` to "FAILED" and set \`amount\` to null. A failed payment is NOT a valid proof of payment.
- If the image shows the payment as PENDING or PROCESSING — set \`status\` to "PENDING" and set \`amount\` to null. A pending payment is NOT a confirmed proof of payment.
- Only set \`status\` to "SUCCESS" when the image explicitly shows the payment was successful (e.g. "Payment Successful", "Money Sent", "Transaction Successful").
- If the status cannot be clearly determined from the image, set \`status\` to "UNKNOWN".
- NEVER extract the amount as a valid payment amount when the status is FAILED, PENDING, DECLINED, REVERSED, or CANCELLED.

- Return ONLY valid JSON.
- Do not return explanations.
- Do not return extra text.`;

const OPENAI_SCHEMA = {
  type: 'object',
  properties: {
    is_payment_screenshot: {
      type: 'boolean',
      description: 'Whether the uploaded image is a UPI payment screenshot',
    },
    payment_app: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description: 'Detected payment app name (e.g. PhonePe, Google Pay, Paytm, BHIM) or null',
    },
    status: {
      type: 'string',
      enum: ['SUCCESS', 'FAILED', 'PENDING', 'UNKNOWN'],
      description: 'Status of the payment',
    },
    amount: {
      anyOf: [{ type: 'number' }, { type: 'null' }],
      description: 'Numeric value of the payment amount only, without ₹ or INR',
    },
    currency: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description: 'Typically INR or null',
    },
    transaction_id: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description: 'Transaction ID as a string or null',
    },
    utr: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description: 'UTR / UPI reference number as a string or null',
    },
    reference_number: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description: 'Any other reference number found as a string or null',
    },
    payer_name: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description: 'Payer name or null',
    },
    payee_name: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description: 'Payee/Merchant name or null',
    },
    upi_id: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description: 'The UPI ID / VPA or null',
    },
    date: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description: 'YYYY-MM-DD or null',
    },
    time: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description: 'HH:MM or null',
    },
    confidence: {
      type: 'number',
      description: 'Confidence score from 0.0 to 1.0',
    },
    raw_text: {
      type: 'string',
      description: 'Raw text summary transcript extracted from the image',
    },
  },
  required: [
    'is_payment_screenshot',
    'payment_app',
    'status',
    'amount',
    'currency',
    'transaction_id',
    'utr',
    'reference_number',
    'payer_name',
    'payee_name',
    'upi_id',
    'date',
    'time',
    'confidence',
    'raw_text',
  ],
  additionalProperties: false,
};

const GEMINI_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    is_payment_screenshot: {
      type: SchemaType.BOOLEAN,
      description: 'Whether the uploaded image is a UPI payment screenshot',
    },
    payment_app: {
      type: SchemaType.STRING,
      nullable: true,
      description: 'Detected payment app name (e.g. PhonePe, Google Pay, Paytm, BHIM) or null',
    },
    status: {
      type: SchemaType.STRING,
      enum: ['SUCCESS', 'FAILED', 'PENDING', 'UNKNOWN'],
      format: 'enum',
      description: 'Status of the payment ("SUCCESS", "FAILED", "PENDING", "UNKNOWN")',
    },
    amount: {
      type: SchemaType.NUMBER,
      nullable: true,
      description: 'Numeric value of the payment amount only, without ₹ or INR',
    },
    currency: {
      type: SchemaType.STRING,
      nullable: true,
      description: 'Typically INR or null',
    },
    transaction_id: {
      type: SchemaType.STRING,
      nullable: true,
      description: 'Transaction ID as a string or null',
    },
    utr: {
      type: SchemaType.STRING,
      nullable: true,
      description: 'UTR / UPI reference number as a string or null',
    },
    reference_number: {
      type: SchemaType.STRING,
      nullable: true,
      description: 'Any other reference number found as a string or null',
    },
    payer_name: {
      type: SchemaType.STRING,
      nullable: true,
      description: 'Payer name or null',
    },
    payee_name: {
      type: SchemaType.STRING,
      nullable: true,
      description: 'Payee/Merchant name or null',
    },
    upi_id: {
      type: SchemaType.STRING,
      nullable: true,
      description: 'The UPI ID / VPA or null',
    },
    date: {
      type: SchemaType.STRING,
      nullable: true,
      description: 'YYYY-MM-DD or null',
    },
    time: {
      type: SchemaType.STRING,
      nullable: true,
      description: 'HH:MM or null',
    },
    confidence: {
      type: SchemaType.NUMBER,
      description: 'Confidence score from 0.0 to 1.0',
    },
    raw_text: {
      type: SchemaType.STRING,
      description: 'Raw text summary transcript extracted from the image',
    },
  },
  required: [
    'is_payment_screenshot',
    'payment_app',
    'status',
    'amount',
    'currency',
    'transaction_id',
    'utr',
    'reference_number',
    'payer_name',
    'payee_name',
    'upi_id',
    'date',
    'time',
    'confidence',
    'raw_text',
  ],
};

/**
 * Image processing service supporting multiple API providers (OpenAI or Gemini),
 * falling back to local Tesseract OCR on API errors or configuration absence.
 */
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(private readonly config: ConfigService) { }

  async extract(imageBuffer: Buffer): Promise<OcrResult> {
    const provider = (this.config.get<string>('ocrProvider') || 'openai').toLowerCase();
    DailyLogger.log(`Starting image extraction using provider: ${provider}`, 'OcrService');

    let result: OcrResult;
    if (provider === 'gemini') {
      result = await this.extractWithGemini(imageBuffer);
    } else {
      result = await this.extractWithOpenAi(imageBuffer);
    }

    if (result.is_payment_screenshot) {
      DailyLogger.log(
        `Successfully extracted payment: app=${result.payment_app}, amount=${result.amount}, utr=${result.utr}, confidence=${result.confidence}`,
        'OcrService'
      );
    } else {
      DailyLogger.log(`Image analyzed: not a payment screenshot.`, 'OcrService');
    }

    return result;
  }

  /**
   * OpenAI API payment screenshot extractor helper.
   */
  private async extractWithOpenAi(imageBuffer: Buffer): Promise<OcrResult> {
    const apiKey = this.config.get<string>('openaiApiKey');
    const modelName = this.config.get<string>('openaiModel') || 'gpt-4o-mini';

    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY is not set. Falling back to local Tesseract.');
      DailyLogger.warn('OPENAI_API_KEY is not set. Falling back to local Tesseract.', 'OcrService');
      return this.fallbackTesseract(imageBuffer);
    }

    try {
      const openai = new OpenAI({ apiKey });
      const base64Image = imageBuffer.toString('base64');
      const mimetype = 'image/png';

      const response = await openai.chat.completions.create({
        model: modelName,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT_TEXT },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimetype};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'upi_payment_extraction',
            strict: true,
            schema: OPENAI_SCHEMA,
          },
        },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty content received from OpenAI Vision API.');
      }

      return this.parseAndValidateResult(content);
    } catch (err) {
      this.logger.error(`OpenAI Vision (${modelName}) extraction failed. Falling back to local Tesseract.`, err as Error);
      DailyLogger.error(`OpenAI Vision (${modelName}) extraction failed. Falling back to local Tesseract.`, (err as Error).stack, 'OcrService');
      return this.fallbackTesseract(imageBuffer);
    }
  }

  /**
   * Gemini 2.5 Flash-Lite payment screenshot extractor helper.
   */
  private async extractWithGemini(imageBuffer: Buffer): Promise<OcrResult> {
    const apiKey = this.config.get<string>('geminiApiKey');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY is not set. Falling back to local Tesseract.');
      DailyLogger.warn('GEMINI_API_KEY is not set. Falling back to local Tesseract.', 'OcrService');
      return this.fallbackTesseract(imageBuffer);
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-3.5-flash-lite',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: GEMINI_SCHEMA,
        },
      });

      const base64Image = imageBuffer.toString('base64');
      const mimetype = 'image/png';

      const result = await model.generateContent([
        PROMPT_TEXT,
        {
          inlineData: {
            data: base64Image,
            mimeType: mimetype,
          },
        },
      ]);

      const content = result.response.text();
      if (!content) {
        throw new Error('Empty content received from Gemini API.');
      }

      return this.parseAndValidateResult(content);
    } catch (err) {
      this.logger.error('Gemini 2.5 Flash-Lite extraction failed. Falling back to local Tesseract.', err as Error);
      DailyLogger.error('Gemini 2.5 Flash-Lite extraction failed. Falling back to local Tesseract.', (err as Error).stack, 'OcrService');
      return this.fallbackTesseract(imageBuffer);
    }
  }

  /**
   * Common result parser, validator, and normalizer.
   */
  private parseAndValidateResult(contentString: string): OcrResult {
    const result = JSON.parse(contentString);

    const isPaymentScreenshot = typeof result.is_payment_screenshot === 'boolean' ? result.is_payment_screenshot : false;
    const confidence = typeof result.confidence === 'number' ? Math.max(0, Math.min(1, result.confidence)) : 0.0;
    const status = ['SUCCESS', 'FAILED', 'PENDING', 'UNKNOWN'].includes(result.status) ? result.status : 'UNKNOWN';

    // Code-level safety net: even if the AI ignores the prompt rule, a FAILED or
    // PENDING payment must NEVER produce a usable amount — it is not valid proof.
    const NON_SUCCESS_STATUSES = ['FAILED', 'PENDING', 'UNKNOWN'];
    const rawAmount = typeof result.amount === 'number' && result.amount > 0 ? Math.round(result.amount) : null;
    const amount = NON_SUCCESS_STATUSES.includes(status) ? null : rawAmount;

    if (!isPaymentScreenshot) {
      return {
        amount: null,
        utr: null,
        upiId: null,
        text: result.raw_text || 'Not a payment screenshot',
        is_payment_screenshot: false,
        payment_app: null,
        status: 'UNKNOWN',
        currency: null,
        transaction_id: null,
        reference_number: null,
        payer_name: null,
        payee_name: null,
        date: null,
        time: null,
        confidence,
      };
    }

    return {
      amount,
      utr: result.utr ? String(result.utr).trim() : null,
      upiId: result.upi_id ? String(result.upi_id).trim().toLowerCase() : null,
      text: result.raw_text || '',
      is_payment_screenshot: true,
      payment_app: result.payment_app || null,
      status,
      currency: result.currency || 'INR',
      transaction_id: result.transaction_id ? String(result.transaction_id).trim() : null,
      reference_number: result.reference_number ? String(result.reference_number).trim() : null,
      payer_name: result.payer_name ? String(result.payer_name).trim() : null,
      payee_name: result.payee_name ? String(result.payee_name).trim() : null,
      date: result.date || null,
      time: result.time || null,
      confidence,
    };
  }

  /**
   * Local Tesseract OCR fallback logic.
   */
  private async fallbackTesseract(imageBuffer: Buffer): Promise<OcrResult> {
    const text = await this.readText(imageBuffer);
    return {
      amount: await this.extractAmount(imageBuffer, text),
      utr: this.parseUtr(text),
      upiId: this.parseUpi(text),
      text,
      is_payment_screenshot: false,
      payment_app: null,
      status: 'UNKNOWN',
      currency: 'INR',
      transaction_id: null,
      reference_number: null,
      payer_name: null,
      payee_name: null,
      date: null,
      time: null,
      confidence: 0.5,
    };
  }

  private async extractAmount(
    imageBuffer: Buffer,
    fullText: string,
  ): Promise<number | null> {
    const strict = this.parseAmount(fullText);
    if (strict != null) return strict;

    try {
      const meta = await sharp(imageBuffer).metadata();
      const width: number = meta.width ?? 0;
      const height: number = meta.height ?? 0;
      if (!width || !height) return this.pickProminentAmount(fullText);

      const cropped = await sharp(imageBuffer)
        .extract({
          left: 0,
          top: 0,
          width,
          height: Math.round(height * 0.55),
        })
        .grayscale()
        .resize({ width: width * 2 })
        .threshold(150)
        .toBuffer();
      const cropText = await this.readText(cropped);
      return (
        this.pickProminentAmount(cropText) ??
        this.pickProminentAmount(fullText)
      );
    } catch (err) {
      this.logger.warn(
        `amount preprocessing failed: ${(err as Error).message}`,
      );
      return this.pickProminentAmount(fullText);
    }
  }

  private pickProminentAmount(text: string): number | null {
    const formatted: number[] = [];
    const fmtRe =
      /(?<![\d,])(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d{2,7}\.\d{2})(?![\d])/g;
    let m: RegExpExecArray | null;
    while ((m = fmtRe.exec(text))) {
      const n = Number(m[1].replace(/,/g, ''));
      if (Number.isFinite(n) && n > 0 && n < 1e7) formatted.push(Math.round(n));
    }
    if (formatted.length) return Math.max(...formatted);

    const bare: number[] = [];
    const bareRe = /(?<![\d,.])(\d{3,6})(?![\d.,])/g;
    while ((m = bareRe.exec(text))) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0) bare.push(n);
    }
    if (bare.length) return Math.max(...bare);
    return null;
  }

  private async readText(imageBuffer: Buffer): Promise<string> {
    const worker = await createWorker();
    try {
      await worker.load();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      const {
        data: { text },
      } = await worker.recognize(imageBuffer);
      return String(text ?? '').trim();
    } catch (err) {
      this.logger.error('tesseract OCR failed', err as Error);
      return '';
    } finally {
      await worker.terminate();
    }
  }

  private parseAmount(text: string): number | null {
    const digits = text.match(
      /(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    );
    if (digits) {
      const n = Number(digits[1].replace(/,/g, ''));
      if (Number.isFinite(n) && n > 0) return Math.round(n);
    }

    const words = text.match(
      /(?:rupees|amount)\s+([a-z\s-]+?)\s+only/i,
    );
    if (words) {
      const n = this.wordsToNumber(words[1]);
      if (n && n > 0) return n;
    }

    return null;
  }

  private wordsToNumber(phrase: string): number | null {
    const UNITS: Record<string, number> = {
      zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
      eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
      fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
      nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
      seventy: 70, eighty: 80, ninety: 90,
    };
    const SCALES: Record<string, number> = {
      hundred: 100, thousand: 1000, lakh: 100000, lac: 100000,
      million: 1000000, crore: 10000000,
    };

    const tokens = phrase.toLowerCase().match(/[a-z]+/g);
    if (!tokens) return null;

    let total = 0;
    let current = 0;
    let found = false;
    for (const t of tokens) {
      if (t in UNITS) {
        current += UNITS[t];
        found = true;
      } else if (t === 'hundred') {
        current = (current || 1) * 100;
        found = true;
      } else if (t in SCALES) {
        current = (current || 1) * SCALES[t];
        total += current;
        current = 0;
        found = true;
      } else if (t === 'and') {
        continue;
      }
    }
    if (!found) return null;
    return total + current;
  }

  private parseUtr(text: string): string | null {
    const m = text.match(
      /(?:utr|upi\s*ref(?:erence)?\s*(?:no|number)?|transaction\s*id|ref\s*no)\s*[:#-]?\s*([a-z0-9]{8,22})/i,
    );
    return m ? m[1].toUpperCase() : null;
  }

  private parseUpi(text: string): string | null {
    const m = text.match(/[a-z0-9.\-_]{2,}@[a-z]{2,}/i);
    return m ? m[0].toLowerCase() : null;
  }
}