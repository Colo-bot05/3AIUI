import type {
  MeetingActionInput,
  MeetingActionResult,
  MeetingProvider,
} from "@/features/meeting/types";

export interface MeetingProviderAdapter {
  readonly name: MeetingProvider;
  performAction(input: MeetingActionInput): Promise<MeetingActionResult>;
}
