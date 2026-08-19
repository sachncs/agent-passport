import { Suspense } from "react"
import { TrustScoreClient } from "./trust-score-client"

export const dynamic = "force-dynamic"

export default function ScorePage() {
  return (
    <Suspense>
      <TrustScoreClient />
    </Suspense>
  )
}
