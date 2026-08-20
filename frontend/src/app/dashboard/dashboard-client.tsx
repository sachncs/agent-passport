"use client"

import { useSearchParams } from "next/navigation"

import { WalletInputPanel } from "./wallet-input-panel"
import { PassportView } from "./passport-view"
import { PageHeader } from "@/components/page-header"

export function DashboardClient() {
  const searchParams = useSearchParams()
  const wallet = searchParams.get("wallet")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Passport Dashboard"
        description="One wallet, every service. Type an address on the left to load the full passport."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[20rem_1fr]">
        <WalletInputPanel wallet={wallet} />
        <PassportView />
      </div>
    </div>
  )
}