import { Suspense } from "react"
import { SybilClient } from "./sybil-client"

export default function SybilPage() {
  return (
    <Suspense>
      <SybilClient />
    </Suspense>
  )
}