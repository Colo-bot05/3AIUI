import { MeetingWorkspace } from "@/components/meeting-workspace";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
      <MeetingWorkspace />
    </main>
  );
}
