import { All, Controller, Param, Req, Res } from '@nestjs/common'
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express'
import { CallsService } from './calls.service.js'
import { BodyTooLargeError, jsonResponse, sendFetchResponse, toFetchRequest } from './fetch-bridge.js'

/** Everything under /sites/:site/ goes through the call pipeline. */
@Controller('sites')
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @All(':site/*path')
  async handle(@Param('site') site: string, @Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    let request: Request
    try { request = await toFetchRequest(req, `/sites/${site}`) } catch (e) {
      return sendFetchResponse(res, e instanceof BodyTooLargeError ? jsonResponse(413, { ok: false, error: { code: 'BAD_REQUEST', message: 'request body too large' } }) : jsonResponse(400, { ok: false, error: { code: 'BAD_REQUEST', message: 'malformed request' } }))
    }
    return sendFetchResponse(res, await this.calls.handle(site, request, req.ip ?? ''))
  }
}
