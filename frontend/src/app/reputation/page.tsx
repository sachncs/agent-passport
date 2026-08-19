import { Suspense } from "react"
export const dynamic = "force-dynamic"
import { ReputationClient } from "./reputation-client"
export default function ReputationPage() {
  return (
    <Suspense>
      <ReputationClient />
    </Suspense>
  )
}
