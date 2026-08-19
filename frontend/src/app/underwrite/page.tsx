import { Suspense } from "react"
export const dynamic = "force-dynamic"
import { UnderwriteClient } from "./underwrite-client"
export default function UnderwritePage() {
  return (
    <Suspense>
      <UnderwriteClient />
    </Suspense>
  )
}
