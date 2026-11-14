import { All, Controller, Param, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { SiteProvidersService } from './site-providers.service.js'

/** /sites/:site/... is handed to that site's own provider, with the prefix stripped. */
@Controller('sites')
export class SitesController {
  constructor(private readonly registry: SiteProvidersService) {}

  @All(':site/*path')
  handle(@Param('site') site: string, @Req() req: Request, @Res() res: Response) {
    const provider = this.registry.get(site)
    if (!provider) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'unknown site' } })
    req.url = req.url.slice(`/sites/${site}`.length) || '/'
    return provider.handler(req, res)
  }
}
