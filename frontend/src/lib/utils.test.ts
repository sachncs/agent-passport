import { describe, expect, it } from "vitest"

import { cn } from "@/lib/utils"

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar")
  })

  it("drops falsy values", () => {
    expect(cn("foo", false, null, undefined, "bar")).toBe("foo bar")
  })

  it("lets tailwind-merge resolve conflicts", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })

  it("preserves non-conflicting classes", () => {
    expect(cn("text-red-500", "font-bold")).toBe("text-red-500 font-bold")
  })

  it("handles arrays and objects from clsx", () => {
    expect(cn("foo", ["bar", "baz"], { qux: true, quux: false })).toBe(
      "foo bar baz qux",
    )
  })
})