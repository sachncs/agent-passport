import { Suspense } from "react"
import { UnderwriteClient } from "./underwrite-client"

export default function UnderwritePage() {
  return (
    <Suspense>
      <UnderwriteClient />
    </Suspense>
  )
}