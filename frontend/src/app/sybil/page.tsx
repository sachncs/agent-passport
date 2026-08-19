import { Suspense } from "react"
export const dynamic = "force-dynamic"
import { SybilClient } from "./sybil-client"
export default function SybilPage() {
  return (
    <Suspense>
      <SybilClient />
    </Suspense>
  )
}
