import { Suspense } from "react"
export const dynamic = "force-dynamic"
import { TrustScoreClient } from "./trust-score-client"
export default function ScorePage() {
  return (
    <Suspense>
      <TrustScoreClient />
    </Suspense>
  )
}
