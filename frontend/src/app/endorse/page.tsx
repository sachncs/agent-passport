"use client"

import { useState } from "react"
import { ShieldAlert } from "lucide-react"

import { isValidWallet } from "@/lib/wallet"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CodeBlock } from "@/components/code-block"

export default function EndorsePage() {
  const [sponsor, setSponsor] = useState("")
  const [agent, setAgent] = useState("")
  const [amount, setAmount] = useState("1000")
  const [output, setOutput] = useState("")

  const generate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidWallet(sponsor) || !isValidWallet(agent)) {
      setOutput("// Enter valid Algorand addresses for both sponsor and agent.")
      return
    }
    if (sponsor === agent) {
      setOutput("// sponsor and agent must be different wallets.")
      return
    }
    const amt = parseFloat(amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setOutput("// amount must be a positive number.")
      return
    }
    setOutput(
      `curl -X POST http://localhost:3000/delegate \\\n` +
        `  -H 'Content-Type: application/json' \\\n` +
        `  -H 'X-Auth-Timestamp: $(date +%s%3N)' \\\n` +
        `  -H 'X-Auth-Nonce: $(uuidgen | tr -d -)' \\\n` +
        `  -H 'X-Auth-KeyId: operator-1' \\\n` +
        `  -H 'X-Auth-Signature: <hmac-sha256-hex>' \\\n` +
        `  -H 'Idempotency-Key: web-$(uuidgen)' \\\n` +
        `  -d '${JSON.stringify({ sponsor, agent, amount: amt })}'\n`,
    )
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <span className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-info-fg">
          Developer surface
        </span>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Endorse / Revoke
        </h1>
        <p className="max-w-2xl text-sm text-muted-fg">
          Submit an on-chain delegation, or revoke one. Requires HMAC +
          Idempotency-Key on the server.
        </p>
      </header>

      <Card className="border-info/30 bg-info-bg">
        <CardContent className="flex items-start gap-3 py-4">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-info-fg" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">Auth required</p>
            <p className="text-muted-fg">
              State-changing endpoints (
              <code className="font-mono">POST /delegate</code>,{" "}
              <code className="font-mono">POST /revoke</code>,{" "}
              <code className="font-mono">POST /reputation/record</code>)
              require <code className="font-mono">HMAC_SECRET</code> +
              signed request headers. The forms below preview the wire
              format; the server will reject unsigned requests with 401.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 py-5">
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-info/30 bg-info-bg px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-info-fg">
                POST
              </span>
              <code className="font-mono text-sm text-foreground">
                /delegate
              </code>
            </div>
            <form onSubmit={generate} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="sponsor">Sponsor wallet</Label>
                <Input
                  id="sponsor"
                  value={sponsor}
                  onChange={(e) => setSponsor(e.target.value)}
                  placeholder="Algorand address (58 chars A-Z, 2-7)"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agent">Agent wallet</Label>
                <Input
                  id="agent"
                  value={agent}
                  onChange={(e) => setAgent(e.target.value)}
                  placeholder="Algorand address (58 chars A-Z, 2-7)"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amount">Amount (microALGO)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <Button type="submit">Preview signed request</Button>
            </form>
            {output && (
              <CodeBlock language="bash" code={output} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 py-5">
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-info/30 bg-info-bg px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-info-fg">
                POST
              </span>
              <code className="font-mono text-sm text-foreground">
                /revoke
              </code>
            </div>
            <CodeBlock
              language="bash"
              code={`# Revoke the delegation from the sponsor to the agent.
# Same auth as /delegate (HMAC + Idempotency-Key).
curl -X POST http://localhost:3000/revoke \\
  -H 'Content-Type: application/json' \\
  -H 'X-Auth-Timestamp: $(date +%s%3N)' \\
  -H 'X-Auth-Nonce: $(uuidgen | tr -d -)' \\
  -H 'X-Auth-KeyId: operator-1' \\
  -H 'X-Auth-Signature: <hmac-sha256-hex>' \\
  -H 'Idempotency-Key: web-$(uuidgen)' \\
  -d '{"sponsor":"$SPONSOR","agent":"$AGENT"}'`}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
