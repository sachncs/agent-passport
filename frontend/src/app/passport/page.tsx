import { Suspense } from "react"
import { PassportClient } from "./passport-client"

export default function PassportPage() {
  return (
    <Suspense>
      <PassportClient />
    </Suspense>
  )
}