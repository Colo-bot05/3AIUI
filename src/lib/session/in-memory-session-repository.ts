import type {
  AppendSessionEntryInput,
  CreateSessionInput,
  SessionRepository,
} from "@/features/session/repository";
import type { MeetingSession, SessionEntry } from "@/features/session/types";

const sessions = new Map<string, MeetingSession>();

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

class InMemorySessionRepository implements SessionRepository {
  async createSession(input: CreateSessionInput): Promise<MeetingSession> {
    const now = new Date().toISOString();
    const session: MeetingSession = {
      id: createId("session"),
      createdAt: now,
      updatedAt: now,
      entries: [],
    };

    sessions.set(session.id, session);
    void input.initialMode;

    return session;
  }

  async getSession(sessionId: string): Promise<MeetingSession | null> {
    return sessions.get(sessionId) ?? null;
  }

  async appendEntry(input: AppendSessionEntryInput): Promise<SessionEntry> {
    const session = sessions.get(input.sessionId);

    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const entry: SessionEntry = {
      id: createId("entry"),
      type: input.type,
      mode: input.mode,
      prompt: input.prompt,
      conversationState: input.conversationState,
      createdAt: new Date().toISOString(),
    };

    session.entries.push(entry);
    session.updatedAt = entry.createdAt;

    return entry;
  }
}

export const inMemorySessionRepository = new InMemorySessionRepository();
