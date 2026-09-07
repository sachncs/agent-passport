import { Suspense } from "react"
import { DelegationClient } from "./delegation-client"

export default function DelegationPage() {
  return (
    <Suspense>
      <DelegationClient />
    </Suspense>
  )
}