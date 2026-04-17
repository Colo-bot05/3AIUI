import type { MeetingProvider, MeetingRunResult, RunMeetingInput } from "@/features/meeting/types";

import type { MeetingProviderAdapter } from "@/lib/orchestrator/provider-adapter";
import { anthropicMeetingProvider } from "@/lib/orchestrator/providers/anthropic-provider";
import { mockMeetingProvider } from "@/lib/orchestrator/providers/mock-provider";

const DEFAULT_PROVIDER: MeetingProvider = "mock";

const PROVIDERS: Partial<Record<MeetingProvider, MeetingProviderAdapter>> = {
  mock: mockMeetingProvider,
  anthropic: anthropicMeetingProvider,
};

export function resolveMeetingProvider(providerName?: string): MeetingProviderAdapter {
  if (!providerName) {
    return PROVIDERS[DEFAULT_PROVIDER]!;
  }

  return PROVIDERS[providerName as MeetingProvider] ?? PROVIDERS[DEFAULT_PROVIDER]!;
}

export async function runMeetingWithProvider(
  input: RunMeetingInput,
  providerName?: string,
): Promise<MeetingRunResult> {
  const provider = resolveMeetingProvider(providerName);
  return provider.runMeeting(input);
}
