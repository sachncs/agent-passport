import { Suspense } from "react"
export const dynamic = "force-dynamic"
import { DelegationClient } from "./delegation-client"
export default function DelegationPage() {
  return (
    <Suspense>
      <DelegationClient />
    </Suspense>
  )
}
