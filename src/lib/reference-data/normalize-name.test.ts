import { describe, expect, it } from "vitest"

import { normalizeReferenceName } from "@/lib/reference-data/normalize-name"

describe("normalizeReferenceName", () => {
  it("trims and lowercases plain ASCII text", () => {
    expect(normalizeReferenceName("  Manager  ")).toBe("manager")
  })

  it("treats case-only variants as the same key", () => {
    expect(normalizeReferenceName("Mühəndis")).toBe(normalizeReferenceName("MÜHƏNDİS"))
    expect(normalizeReferenceName("Ofis Meneceri")).toBe(normalizeReferenceName("Ofis meneceri"))
  })

  it("collapses internal whitespace runs", () => {
    expect(normalizeReferenceName("Mühəndis   Şöbəsi")).toBe(normalizeReferenceName("Mühəndis Şöbəsi"))
  })

  it("keeps Azerbaijani dotless-ı distinct from dotted-i", () => {
    expect(normalizeReferenceName("Maşınist")).not.toBe(normalizeReferenceName("Maşinist"))
  })

  it("lowercases Turkic dotted İ to dotted i, not ASCII i from dotless I", () => {
    expect(normalizeReferenceName("İSMAYILOV")).toBe(normalizeReferenceName("ismayılov"))
  })

  it("treats NFC and NFD encodings of the same text as equal", () => {
    const nfc = "Bakı".normalize("NFC")
    const nfd = "Bakı".normalize("NFD")
    expect(normalizeReferenceName(nfc)).toBe(normalizeReferenceName(nfd))
  })

  /**
   * Known, accepted limitation: under the "az" locale, ASCII "I" lowercases
   * to dotless "ı" (Azerbaijani has no dotless-capital/dotted-lowercase
   * pairing the way English does), so an ALL-CAPS word borrowed from
   * English/Russian ("CLEANING") won't re-normalize to the same key as its
   * naturally-cased form ("Cleaning"). This only bites plain-ASCII words
   * typed in full capitals; real Azerbaijani text (this product's actual
   * data — Position/Company/Department names) always uses the correct
   * distinct İ/I codepoint for the sound it means, so this doesn't affect
   * genuine Azerbaijani duplicates like Mühəndis/MÜHƏNDİS above.
   */
  it("does not round-trip an all-caps ASCII word containing the letter I", () => {
    expect(normalizeReferenceName("CLEANING")).not.toBe(normalizeReferenceName("Cleaning"))
  })
})
