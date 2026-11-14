import { Module } from '@nestjs/common'
import { CallsController } from './calls.controller.js'
import { CallsService } from './calls.service.js'
import { FailClosedPaymentGate } from './fail-closed-gate.js'
import { PAYMENT_GATE } from './payment-gate.js'

/** Phase 2 replaces the PAYMENT_GATE provider with the real x402 gate; nothing else here changes. */
@Module({ controllers: [CallsController], providers: [CallsService, { provide: PAYMENT_GATE, useClass: FailClosedPaymentGate }] })
export class CallsModule {}
