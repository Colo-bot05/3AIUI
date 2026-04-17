import type {
  MeetingProvider,
  MeetingRunResult,
  RunMeetingInput,
} from "@/features/meeting/types";

export interface MeetingProviderAdapter {
  readonly name: MeetingProvider;
  runMeeting(input: RunMeetingInput): Promise<MeetingRunResult>;
}
