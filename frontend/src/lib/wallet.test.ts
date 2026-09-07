import { describe, expect, it } from "vitest"

import { isValidWallet, WALLET_REGEX } from "@/lib/wallet"

const VALID =
  "GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A"

describe("isValidWallet", () => {
  it("accepts a valid 58-char Algorand address", () => {
    expect(isValidWallet(VALID)).toBe(true)
  })

  it("rejects addresses that are too short", () => {
    expect(isValidWallet(VALID.slice(0, 50))).toBe(false)
  })

  it("rejects addresses that are too long", () => {
    expect(isValidWallet(VALID + "ABC")).toBe(false)
  })

  it("rejects lowercase addresses (Algorand uses uppercase base32)", () => {
    expect(isValidWallet(VALID.toLowerCase())).toBe(false)
  })

  it("rejects characters outside A-Z and 2-7", () => {
    expect(isValidWallet("1".repeat(58))).toBe(false)
    expect(isValidWallet(VALID.replace(/A$/, "8"))).toBe(false)
    expect(isValidWallet(VALID.replace(/A$/, "0"))).toBe(false)
    expect(isValidWallet(VALID.replace(/A$/, "9"))).toBe(false)
  })

  it("rejects empty string", () => {
    expect(isValidWallet("")).toBe(false)
  })

  it("rejects non-string inputs", () => {
    expect(isValidWallet(undefined as unknown as string)).toBe(false)
    expect(isValidWallet(null as unknown as string)).toBe(false)
    expect(isValidWallet(123 as unknown as string)).toBe(false)
  })

  it("exposes the regex shape", () => {
    expect(WALLET_REGEX.source).toBe("^[A-Z2-7]{58}$")
  })
})