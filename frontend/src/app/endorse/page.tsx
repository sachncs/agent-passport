import { useState } from "react"

import { isValidWallet } from "@/lib/wallet"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/page-header"
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
      `# POST /delegate — signed example\n` +
      `# Requires HMAC + Idempotency-Key (see docs/security.md)\n` +
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
    <>
      <PageHeader
        title="Endorse / Revoke"
        description="Submit an on-chain delegation, or revoke one. Requires HMAC + Idempotency-Key on the server."
      />
      <Alert className="mb-4">
        <AlertTitle>Auth required</AlertTitle>
        <AlertDescription>
          State-changing endpoints (POST /delegate, POST /revoke, POST
          /reputation/record) require <code>HMAC_SECRET</code> + signed
          request headers. The form below previews the wire format; the
          server will reject unsigned requests with 401.
        </AlertDescription>
      </Alert>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>POST /delegate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 text-xs">
                {output}
              </pre>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>POST /revoke</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 text-xs">
              {`# Revoke the delegation from the sponsor to the agent.
# Same auth as /delegate (HMAC + Idempotency-Key).
curl -X POST http://localhost:3000/revoke \\
  -H 'Content-Type: application/json' \\
  -H 'X-Auth-Timestamp: $(date +%s%3N)' \\
  -H 'X-Auth-Nonce: $(uuidgen | tr -d -)' \\
  -H 'X-Auth-KeyId: operator-1' \\
  -H 'X-Auth-Signature: <hmac-sha256-hex>' \\
  -H 'Idempotency-Key: web-$(uuidgen)' \\
  -d '{"sponsor":"$SPONSOR","agent":"$AGENT"}'`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
