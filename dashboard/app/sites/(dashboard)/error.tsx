'use client'

import { RouteFailure, type FailureProps } from '@/components/sections/route-failure'

export default function DashboardError(props: FailureProps) {
  return <RouteFailure {...props} />
}
