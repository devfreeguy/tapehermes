import type { Request as ExpressRequest, Response as ExpressResponse } from 'express'

const MAX_BODY_BYTES = 64 * 1024

export class BodyTooLargeError extends Error {}

/** Read the raw request body (bodyParser is off: the provider wants the raw bytes), capped. */
async function readBody(req: ExpressRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  let n = 0
  for await (const c of req) {
    n += (c as Buffer).length
    if (n > MAX_BODY_BYTES) throw new BodyTooLargeError()
    chunks.push(c as Buffer)
  }
  return Buffer.concat(chunks)
}

/** Express request to a fetch Request, with the /sites/:site prefix removed (the provider sees /tapeapi/v1/...). */
export async function toFetchRequest(req: ExpressRequest, stripPrefix: string): Promise<Request> {
  const path = req.originalUrl.slice(stripPrefix.length) || '/'
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS'
  const body = hasBody ? await readBody(req) : undefined
  return new Request(`http://site.internal${path}`, { method: req.method, headers, body: body && body.length ? new Uint8Array(body) : undefined })
}

export async function sendFetchResponse(res: ExpressResponse, r: Response): Promise<void> {
  res.status(r.status)
  r.headers.forEach((v, k) => res.setHeader(k, v))
  res.end(Buffer.from(await r.arrayBuffer()))
}

export const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type,accept', ...headers },
  })
