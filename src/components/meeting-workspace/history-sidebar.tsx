import type { MeetingMode, MeetingSummary } from "@/features/meeting/types";

export interface HistorySidebarProps {
  meetings: MeetingSummary[];
  activeMeetingId: string | null;
  onSelect: (id: string) => void;
  onStartNewMeeting: () => void;
}

const MODE_LABELS: Record<MeetingMode, string> = {
  brainstorm: "ブレスト",
  design_review: "ディスカッション",
  debate: "ディベート",
};

const MODE_TONES: Record<MeetingMode, string> = {
  brainstorm: "bg-orange-100 text-orange-900 border-orange-200",
  design_review: "bg-sky-100 text-sky-900 border-sky-200",
  debate: "bg-emerald-100 text-emerald-900 border-emerald-200",
};

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "たった今";
  if (diff < hour) return `${Math.floor(diff / minute)}分前`;
  if (diff < day) return `${Math.floor(diff / hour)}時間前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}日前`;
  return new Date(iso).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
  });
}

function truncateTopic(topic: string, limit = 40): string {
  if (topic.length <= limit) return topic;
  return `${topic.slice(0, limit)}…`;
}

export function HistorySidebar({
  meetings,
  activeMeetingId,
  onSelect,
  onStartNewMeeting,
}: HistorySidebarProps) {
  return (
    <aside className="glass-panel rounded-[2rem] p-4 xl:sticky xl:top-8 xl:self-start">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="section-title">History</p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-zinc-950">
            会議履歴
          </h2>
        </div>
        <button
          type="button"
          onClick={onStartNewMeeting}
          className="rounded-full border border-zinc-900/10 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800"
        >
          + 新しい会議
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-zinc-500">
        過去の会議をクリックすると閲覧モードで復元されます。
      </p>

      <div className="mt-4 space-y-2">
        {meetings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-3 text-xs leading-6 text-zinc-500">
            会議履歴はまだありません。最初の Continue で記録されます。
          </div>
        ) : (
          meetings.map((meeting) => {
            const active = meeting.id === activeMeetingId;
            return (
              <button
                key={meeting.id}
                type="button"
                onClick={() => onSelect(meeting.id)}
                className={`block w-full rounded-2xl border px-3 py-3 text-left transition ${
                  active
                    ? "border-zinc-950 bg-zinc-950 text-white shadow-sm"
                    : "border-zinc-900/10 bg-white text-zinc-700 hover:border-zinc-900/20 hover:bg-zinc-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-mono ${
                      active
                        ? "border-white/20 bg-white/10 text-white/80"
                        : MODE_TONES[meeting.mode]
                    }`}
                  >
                    {MODE_LABELS[meeting.mode]}
                  </span>
                  <span
                    className={`text-[10px] font-mono ${
                      active ? "text-white/70" : "text-zinc-500"
                    }`}
                  >
                    {formatRelativeTime(meeting.updatedAt)}
                  </span>
                </div>
                <div
                  className={`mt-2 text-xs leading-5 ${
                    active ? "text-white/95" : "text-zinc-800"
                  }`}
                >
                  {truncateTopic(meeting.topic)}
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
