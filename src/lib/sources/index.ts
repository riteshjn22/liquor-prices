import { fetchDelhi, type FetchOptions, type SourceFetch } from "./delhi";

/** One fetcher per state slug. Add new states here. */
export const SOURCES: Record<string, (opts?: FetchOptions) => Promise<SourceFetch>> = {
  delhi: fetchDelhi,
};

export type { FetchOptions, SourceFetch };
