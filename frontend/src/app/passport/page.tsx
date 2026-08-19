import { Suspense } from "react"
export const dynamic = "force-dynamic"
import { PassportClient } from "./passport-client"
export default function PassportPage() {
  return (
    <Suspense>
      <PassportClient />
    </Suspense>
  )
}
