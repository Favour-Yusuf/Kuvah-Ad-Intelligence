import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AnalyzerError, type AdAnalyzer, type AnalysisInput } from "../analyzer";
import { SYSTEM_PROMPT, buildUserText } from "../prompt";
import { modelOutputSchema } from "../schema";

type Config = { apiKey: string; model: string };

/**
 * Claude implementation of AdAnalyzer. Uses structured outputs for a typed
 * result and server-side refusal fallbacks, so a policy decline on the primary
 * model is retried on Anthropic's recommended fallback within the same call.
 */
export function createAnthropicAnalyzer({ apiKey, model }: Config): AdAnalyzer {
  // maxRetries covers 429/5xx/connection errors; the route enforces the overall deadline.
  const client = new Anthropic({ apiKey, maxRetries: 2 });

  return {
    provider: "anthropic",
    model,
    async analyze(input: AnalysisInput, signal: AbortSignal) {
      const content: Anthropic.Beta.BetaContentBlockParam[] = [];
      if (input.image) {
        content.push({ type: "image", source: { type: "base64", media_type: input.image.mediaType, data: input.image.base64 } });
      }
      content.push({ type: "text", text: buildUserText(input) });

      let response;
      try {
        response = await client.beta.messages.parse(
          {
            model,
            max_tokens: 16000,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            // Thinking is always on for current models; effort sets its depth.
            output_config: { effort: "high", format: betaZodOutputFormat(modelOutputSchema) },
            system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
            messages: [{ role: "user", content }],
          },
          { signal },
        );
      } catch (error) {
        if (signal.aborted) throw new AnalyzerError("timeout", "The analysis took too long. Try again.", error);
        if (error instanceof Anthropic.RateLimitError) {
          throw new AnalyzerError("unavailable", "The AI service is busy. Wait a minute and try again.", error);
        }
        if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
          throw new AnalyzerError("unavailable", "AI analysis is not configured correctly. Ask an admin to check the API key.", error);
        }
        if (error instanceof Anthropic.BadRequestError) {
          throw new AnalyzerError("unavailable", "The AI service rejected this request. Try again, or remove the image.", error);
        }
        if (error instanceof Anthropic.APIError) {
          throw new AnalyzerError("unavailable", "The AI service is unavailable. Try again shortly.", error);
        }
        throw new AnalyzerError("unavailable", "Could not reach the AI service. Try again shortly.", error);
      }

      if (response.stop_reason === "refusal") {
        throw new AnalyzerError("refused", "The AI declined to analyse this ad.", response.stop_details);
      }
      if (response.stop_reason === "max_tokens") {
        throw new AnalyzerError("truncated", "The analysis was cut short. Try again.");
      }
      if (!response.parsed_output) {
        throw new AnalyzerError("invalid_output", "The AI returned an analysis in an unexpected format. Try again.");
      }
      return response.parsed_output;
    },
  };
}
