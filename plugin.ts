import type { IncomingMessage, ServerResponse } from 'node:http'
import { loadEnv, type Connect, type Plugin } from 'vite'
import { LIMITS } from '../src/urja/contract'
import { apiKeyStatus, askUrja, synthesizeUrjaVoice, UrjaError, validateRequest, validateSpeechRequest } from './askUrja'

/**
 * Ask URJA AI runs inside the Vite dev server and the Vite preview server.
 * The Gemini key stays in Node. The React app only calls /api/urja.
 * A static file host cannot run this route; use `pnpm dev` or `pnpm preview`.
 */
export function urjaApiPlugin(): Plugin {
  const hits = new Map<string, number[]>()
  const runtime = { mode: 'development', envDir: process.cwd() }

  const handle: Connect.NextHandleFunction = (req, res, next) => {
    const path = req.url?.split('?')[0]
    if (path !== '/api/urja' && path !== '/api/urja/voice') return next()
    const handler = path === '/api/urja/voice' ? handleUrjaVoice : handleUrja
    void handler(req, res, hits, runtime).catch(() => {
      console.error('[urja-ai] unexpected failure')
      sendJson(res, 500, { error: 'Something went wrong on URJA AI\'s side. Please try again.' })
    })
  }

  return {
    name: 'urja-ai-api',
    configResolved(config) {
      runtime.mode = config.mode || 'development'
      runtime.envDir = config.envDir || process.cwd()
    },
    configureServer(server) {
      server.middlewares.use(handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle)
    },
  }
}

function allow(ip: string, hits: Map<string, number[]>): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter(time => now - time < 60_000)
  if (recent.length >= LIMITS.requestsPerMinute) {
    hits.set(ip, recent)
    return false
  }
  recent.push(now)
  hits.set(ip, recent)
  return true
}

async function handleUrja(
  req: IncomingMessage,
  res: ServerResponse,
  hits: Map<string, number[]>,
  runtime: { mode: string; envDir: string },
) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Ask URJA AI only accepts a question.' })
    return
  }

  const ip = req.socket.remoteAddress ?? 'local'
  if (!allow(ip, hits)) {
    sendJson(res, 429, { error: 'URJA AI needs a short pause. Wait a moment, then ask again.' })
    return
  }

  let body: unknown
  try {
    body = await readJson(req, LIMITS.bodyMax)
  } catch (error) {
    const tooLarge = error instanceof UrjaError && error.status === 413
    sendJson(res, tooLarge ? 413 : 400, {
      error: tooLarge
        ? 'That message is too large. Ask a shorter question.'
        : 'URJA AI could not read that request. Try asking again.',
    })
    return
  }

  let request
  try {
    request = validateRequest(body)
  } catch (error) {
    const status = error instanceof UrjaError ? error.status : 400
    const message = error instanceof UrjaError ? error.message : 'URJA AI could not read that request. Try asking again.'
    sendJson(res, status, { error: message })
    return
  }

  const env = loadEnv(runtime.mode, runtime.envDir, '')
  const apiKey = apiKeyStatus(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY)
  if (!apiKey) {
    sendJson(res, 503, {
      error: 'URJA AI is not connected yet. Configure GEMINI_API_KEY on the secure server, restart the app, and try again.',
    })
    return
  }

  try {
    const result = await askUrja(apiKey, request)
    sendJson(res, 200, result)
  } catch (error) {
    const status = error instanceof UrjaError ? error.status : 502
    const message = error instanceof UrjaError ? error.message : 'URJA AI could not finish that answer. Please try again.'
    sendJson(res, status, { error: message })
  }
}

async function handleUrjaVoice(
  req: IncomingMessage,
  res: ServerResponse,
  hits: Map<string, number[]>,
  runtime: { mode: string; envDir: string },
) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'URJA AI voice only accepts a reply to speak.' })
    return
  }

  const ip = req.socket.remoteAddress ?? 'local'
  if (!allow(ip, hits)) {
    sendJson(res, 429, { error: 'URJA AI voice needs a short pause. Wait a moment, then try again.' })
    return
  }

  let request
  try {
    request = validateSpeechRequest(await readJson(req, LIMITS.bodyMax))
  } catch (error) {
    const status = error instanceof UrjaError ? error.status : 400
    const message = error instanceof UrjaError ? error.message : 'URJA AI could not read that voice request. Try again.'
    sendJson(res, status, { error: message })
    return
  }

  const env = loadEnv(runtime.mode, runtime.envDir, '')
  const apiKey = apiKeyStatus(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY)
  if (!apiKey) {
    sendJson(res, 503, {
      error: 'URJA AI voice is not connected yet. Configure GEMINI_API_KEY on the secure server and restart the app.',
    })
    return
  }

  try {
    const result = await synthesizeUrjaVoice(apiKey, request.text, request.language)
    res.statusCode = 200
    res.setHeader('Content-Type', result.mimeType)
    res.setHeader('Cache-Control', 'no-store')
    res.end(result.audio)
  } catch (error) {
    const status = error instanceof UrjaError ? error.status : 502
    const message = error instanceof UrjaError ? error.message : 'URJA AI could not prepare the spoken reply. Please try again.'
    sendJson(res, status, { error: message })
  }
}

function readJson(req: IncomingMessage, limit: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let failed = false
    req.on('data', (chunk: Buffer) => {
      if (failed) return
      size += chunk.length
      if (size > limit) {
        failed = true
        reject(new UrjaError(413, 'too large'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (failed) return
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new UrjaError(400, 'invalid json'))
      }
    })
    req.on('error', () => {
      if (!failed) reject(new UrjaError(400, 'invalid json'))
    })
  })
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  if (res.writableEnded) return
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(payload))
}
