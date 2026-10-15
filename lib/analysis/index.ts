import "server-only";
import { serverEnv } from "@/lib/env.server";
import type { AdAnalyzer } from "./analyzer";
import { createAnthropicAnalyzer } from "./providers/anthropic";
import { createFakeAnalyzer } from "./providers/fake";

/** The configured analyzer. Swap providers here without touching routes or UI. */
export function getAnalyzer(): AdAnalyzer {
  const env = serverEnv();
  if (env.ANALYSIS_PROVIDER === "fake") return createFakeAnalyzer();
  return createAnthropicAnalyzer({ apiKey: env.ANTHROPIC_API_KEY!, model: env.ANTHROPIC_MODEL });
}
