import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai'
import {
  LESSON_ID,
  LIMITS,
  replyToText,
  type AskUrjaRequest,
  type HistoryTurn,
  type UrjaReply,
} from '../src/urja/contract'
import { CURRENT_LESSON, isLanguage, isTeachingApproach } from './lesson'
import { buildSystemInstruction } from './prompt'

/**
 * Model order. The first is tried first; if Google answers 503/429 repeatedly
 * we move down the list. All three IDs are listed on ai.google.dev/gemini-api/docs/models.
 */
const MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite']
const VOICE_MODEL = 'gemini-3.8-flash-tts'
const PLACEHOLDER_KEY = 'your_gemini_api_key_here'
const ATTEMPTS_PER_MODEL = 2
const REQUEST_TIMEOUT_MS = 25_000

export class UrjaError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.replace(/\u0000/g, '').trim()
  if (!text || text.length > max) return null
  return text
}

export function validateRequest(body: unknown): AskUrjaRequest {
  if (!body || typeof body !== 'object') {
    throw new UrjaError(400, 'URJA AI could not read that request. Try asking again.')
  }
  const input = body as Partial<AskUrjaRequest>
  if (input.lessonId !== LESSON_ID) {
    throw new UrjaError(400, 'This lesson is not available for Ask URJA AI yet.')
  }
  if (!isTeachingApproach(input.teachingApproach) || !isLanguage(input.language)) {
    throw new UrjaError(400, 'Choose a teaching style and language from the lesson setup, then try again.')
  }
  const question = cleanText(input.question, LIMITS.questionMax)
  if (!question) {
    const raw = typeof input.question === 'string' ? input.question.trim() : ''
    throw new UrjaError(400, raw.length > LIMITS.questionMax
      ? 'That question is a bit long. Try asking it in fewer words.'
      : 'Type a question before asking URJA AI.')
  }
  if (!Array.isArray(input.history) || input.history.length > LIMITS.historyMax) {
    throw new UrjaError(400, 'This conversation got hard to read. Start it over, then ask again.')
  }
  const history: HistoryTurn[] = input.history.map(turn => {
    if (!turn || typeof turn !== 'object') {
      throw new UrjaError(400, 'This conversation got hard to read. Start it over, then ask again.')
    }
    const role = (turn as HistoryTurn).role
    const content = cleanText((turn as HistoryTurn).content, LIMITS.historyItemMax)
    if ((role !== 'user' && role !== 'assistant') || !content) {
      throw new UrjaError(400, 'This conversation got hard to read. Start it over, then ask again.')
    }
    return { role, content }
  })
  return {
    lessonId: LESSON_ID,
    teachingApproach: input.teachingApproach,
    language: input.language,
    question,
    history,
  }
}

export function validateSpeechRequest(body: unknown): { text: string; language: AskUrjaRequest['language'] } {
  if (!body || typeof body !== 'object') {
    throw new UrjaError(400, 'URJA AI could not read that voice request. Try again.')
  }
  const input = body as { text?: unknown; language?: unknown }
  const text = cleanText(input.text, LIMITS.speechTextMax)
  if (!text) {
    throw new UrjaError(400, typeof input.text === 'string' && input.text.trim().length > LIMITS.speechTextMax
      ? 'That reply is too long to read aloud. Try a shorter explanation.'
      : 'There is no reply to read aloud yet.')
  }
  if (!isLanguage(input.language)) {
    throw new UrjaError(400, 'Choose English, Hindi, or Hinglish before playing the voice reply.')
  }
  return { text, language: input.language }
}

function clip(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  const text = value.replace(/\u0000/g, '').trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function asReply(value: unknown): UrjaReply {
  if (!value || typeof value !== 'object') {
    throw new UrjaError(502, 'URJA AI sent an answer that could not be read. Please ask once more.')
  }
  const record = value as Record<string, unknown>
  const explanation = clip(record.explanation, 1800)
  if (!explanation) {
    throw new UrjaError(502, 'URJA AI sent an empty answer. Please ask once more.')
  }
  const steps = Array.isArray(record.steps)
    ? record.steps.map(step => clip(step, 400)).filter(Boolean).slice(0, 5)
    : []
  return {
    explanation,
    steps,
    example: clip(record.example, 800),
    takeaway: clip(record.takeaway, 400),
    followUp: clip(record.followUp, 240),
  }
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    explanation: {
      type: Type.STRING,
      description: 'The main spoken explanation. Required.',
    },
    steps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Up to 5 short steps, or an empty array.',
    },
    example: {
      type: Type.STRING,
      description: 'One example, or an empty string.',
    },
    takeaway: {
      type: Type.STRING,
      description: 'One sentence to remember, or an empty string.',
    },
    followUp: {
      type: Type.STRING,
      description: 'One useful follow-up question, or an empty string.',
    },
  },
  required: ['explanation', 'steps', 'example', 'takeaway', 'followUp'],
  propertyOrdering: ['explanation', 'steps', 'example', 'takeaway', 'followUp'],
}

export function apiKeyStatus(apiKey: string | undefined): string {
  const key = apiKey?.trim() ?? ''
  if (!key || key === PLACEHOLDER_KEY) return ''
  return key
}

function statusOf(error: unknown): number {
  return typeof error === 'object' && error && 'status' in error && typeof error.status === 'number'
    ? error.status
    : 0
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export async function askUrja(apiKey: string, request: AskUrjaRequest): Promise<{ reply: UrjaReply; text: string }> {
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: REQUEST_TIMEOUT_MS } })
  const contents = [
    ...request.history.map(turn => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.content }],
    })),
    { role: 'user', parts: [{ text: request.question }] },
  ]
  const systemInstruction = buildSystemInstruction(CURRENT_LESSON, request.teachingApproach, request.language)

  let raw = ''
  let lastStatus = 0
  let done = false

  for (let m = 0; m < MODELS.length && !done; m += 1) {
    const model = MODELS[m]
    for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL && !done; attempt += 1) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            temperature: 0.4,
            maxOutputTokens: 1500,
            responseMimeType: 'application/json',
            responseJsonSchema: responseSchema,
            // Only the primary model gets the thinking setting; fallbacks use their defaults.
            ...(m === 0 ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
          },
        })
        raw = response.text ?? ''
        done = true
      } catch (error) {
        lastStatus = statusOf(error)
        console.error('[urja-ai] upstream failure', model, lastStatus || 'unknown', `attempt ${attempt}`)
        // Key problems will not fix themselves on another model.
        if (lastStatus === 401 || lastStatus === 403) {
          throw new UrjaError(503, 'URJA AI could not use the Gemini API key. Check the server environment configuration and try again.')
        }
        const temporary = lastStatus === 429 || lastStatus === 503 || lastStatus === 500 || lastStatus === 504 || lastStatus === 0
        if (!temporary) break // e.g. 400/404: skip to the next model
        if (attempt < ATTEMPTS_PER_MODEL) await sleep(700 * attempt + Math.floor(Math.random() * 300))
      }
    }
  }

  if (!done) {
    if (lastStatus === 429) {
      throw new UrjaError(503, 'URJA AI is busy right now. Wait a few seconds, then ask again.')
    }
    if (lastStatus === 503) {
      throw new UrjaError(503, 'URJA AI is under heavy demand right now. Wait a moment, then try again.')
    }
    throw new UrjaError(502, 'URJA AI could not finish that answer. Please try again.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start === -1 || end <= start) {
      console.error('[urja-ai] unreadable model payload')
      throw new UrjaError(502, 'URJA AI could not finish that answer. Please try again.')
    }
    try {
      parsed = JSON.parse(raw.slice(start, end + 1))
    } catch {
      console.error('[urja-ai] unreadable model payload')
      throw new UrjaError(502, 'URJA AI could not finish that answer. Please try again.')
    }
  }

  const reply = asReply(parsed)
  return { reply, text: replyToText(reply) }
}

export async function synthesizeUrjaVoice(
  apiKey: string,
  text: string,
  language: AskUrjaRequest['language'],
): Promise<{ audio: Buffer; mimeType: string }> {
  const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1beta' } })
  try {
    const response = await ai.interactions.create({
      model: VOICE_MODEL,
      input: [{
        type: 'user_input',
        content: [{
          type: 'text',
          text,
          annotations: [{
            type: 'speech_metadata',
            style: `Warm, clear classroom tutor voice. Speak naturally in ${language} with a calm pace and a natural Indian accent.`,
          }],
        }],
      }],
      response_format: { type: 'audio' },
      generation_config: { speech_config: [{ voice: 'Kore' }] },
    })
    const audio = response.output_audio?.data
    if (!audio) {
      throw new UrjaError(502, 'URJA AI could not prepare the spoken reply. Please try again.')
    }
    return {
      audio: Buffer.from(audio, 'base64'),
      mimeType: response.output_audio?.mime_type ?? 'audio/wav',
    }
  } catch (error) {
    if (error instanceof UrjaError) throw error
    const status = statusOf(error)
    console.error('[urja-ai] voice generation failure', status || 'unknown')
    if (status === 429) {
      throw new UrjaError(503, 'URJA AI voice is busy right now. Wait a few seconds, then try again.')
    }
    if (status === 401 || status === 403 || status === 404) {
      throw new UrjaError(503, 'URJA AI voice is not available for this API key yet. Check the Gemini API account and try again.')
    }
    throw new UrjaError(502, 'URJA AI could not prepare the spoken reply. Please try again.')
  }
}
