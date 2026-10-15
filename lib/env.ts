import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
  ANALYSIS_PROVIDER: z.enum(["anthropic", "fake"]).default("anthropic"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-5-5"),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function formatIssues(error: z.ZodError) {
  return error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
}

/**
 * Public values are inlined by Next.js only when referenced literally,
 * so each one is read by name here.
 */
export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const result = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: source.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: source.NEXT_PUBLIC_SITE_URL || undefined,
  });
  if (!result.success) {
    throw new Error(`Invalid public environment: ${formatIssues(result.error)}`);
  }
  return result.data;
}

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverSchema.safeParse({
    SUPABASE_SECRET_KEY: source.SUPABASE_SECRET_KEY,
    ANALYSIS_PROVIDER: source.ANALYSIS_PROVIDER || undefined,
    ANTHROPIC_API_KEY: source.ANTHROPIC_API_KEY || undefined,
    ANTHROPIC_MODEL: source.ANTHROPIC_MODEL || undefined,
  });
  if (!result.success) {
    throw new Error(`Invalid server environment: ${formatIssues(result.error)}`);
  }
  if (result.data.ANALYSIS_PROVIDER === "anthropic" && !result.data.ANTHROPIC_API_KEY) {
    throw new Error("Invalid server environment: ANTHROPIC_API_KEY is required when ANALYSIS_PROVIDER=anthropic");
  }
  return result.data;
}

export function publicEnv(): PublicEnv {
  return parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
}
