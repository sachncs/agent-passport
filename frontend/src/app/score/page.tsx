import { Suspense } from "react"
import { TrustScoreClient } from "./trust-score-client"

export default function ScorePage() {
  return (
    <Suspense>
      <TrustScoreClient />
    </Suspense>
  )
}