import { Suspense } from "react"
import { ReputationClient } from "./reputation-client"

export default function ReputationPage() {
  return (
    <Suspense>
      <ReputationClient />
    </Suspense>
  )
}