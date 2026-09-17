"use server"

import { runGlobalSearch } from "@/lib/global-search/global-search-service"
import type { GlobalSearchResponse } from "@/types/global-search"

/**
 * The one server boundary Global Search crosses — employee PII (phone,
 * email, FIN) is filtered here, server-side, and only the small matched
 * result set (title/subtitle/href, max 5 per category) ever reaches the
 * browser. A client-side implementation would have needed the full
 * employee directory shipped to every page just to search it, which this
 * avoids entirely.
 */
export async function globalSearchAction(query: string): Promise<GlobalSearchResponse> {
  return runGlobalSearch(query)
}
