import { Module } from '@nestjs/common'
import { x402ResourceServer } from '@okxweb3/x402-core/server'
import { APP_CONFIG, type AppConfig } from '../config/app-config.js'
import { createOkxResourceServer } from '../payments/okx-resource-server.js'
import { CallsController } from './calls.controller.js'
import { CallsService } from './calls.service.js'
import { PAYMENT_GATE } from './payment-gate.js'
import { X402_RESOURCE_SERVER, X402PaymentGate } from './x402-payment-gate.js'

/**
 * Payments: x402 through the OKX facilitator, settle mode sync, network from X402_NETWORK (1952 now, 196 later; no code change).
 * Without OKX credentials the server still starts, and priced routes fail closed (503).
 */
@Module({
  controllers: [CallsController],
  providers: [
    CallsService,
    {
      provide: X402_RESOURCE_SERVER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): x402ResourceServer | null => (config.okx ? (createOkxResourceServer(config.x402Network, true, config.okx) as unknown as x402ResourceServer) : null),
    },
    { provide: PAYMENT_GATE, useClass: X402PaymentGate },
  ],
})
export class CallsModule {}
