"use client";

import type { ChangeEvent } from "react";
import { useRef, useState } from "react";

import type { WorkspaceAttachmentItem } from "@/features/attachments/types";
import { MODE_OPTIONS } from "@/features/meeting/mode-config";
import {
  buildDebateJudgmentDisplay,
  buildSynthesisDisplay,
} from "@/features/meeting/presentation";
import {
  buildConversationStateSnapshot,
  getAllowedStatesForMode,
  getInitialConversationState,
  isExplicitJudgmentTrigger,
  isExplicitSynthesisTrigger,
} from "@/features/meeting/state";
import type {
  ConversationState,
  DebateModel,
  DebateRole,
  DebateRoleAssignments,
  MeetingAttachment,
  MeetingMode,
  MeetingRunResult,
} from "@/features/meeting/types";
import { inMemorySessionRepository } from "@/lib/session/in-memory-session-repository";

import { ControlSidebar } from "./meeting-workspace/control-sidebar";
import {
  DEBATE_ROLE_LABELS,
  DEFAULT_THEME,
  INITIAL_DEBATE_ASSIGNMENTS,
  INITIAL_RESULT,
  PANEL_PLACEHOLDERS,
  buildFallbackAttachmentErrorItem,
  buildSessionAttachmentContext,
  buildTimelineEntries,
  parseSelectedAttachmentFile,
  pickActionLabels,
  pickModelLabel,
  type WorkspaceAction,
} from "./meeting-workspace/shared";
import { TimelinePanel } from "./meeting-workspace/timeline-panel";

export function MeetingWorkspace() {
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [submittedPrompt, setSubmittedPrompt] = useState(DEFAULT_THEME);
  const [mode, setMode] = useState<MeetingMode>("design_review");
  const [conversationState, setConversationState] = useState<ConversationState>(
    getInitialConversationState("design_review"),
  );
  const [result, setResult] = useState<MeetingRunResult>(INITIAL_RESULT);
  const [lastDiscussionMode, setLastDiscussionMode] =
    useState<MeetingMode>("design_review");
  const [debateAssignments, setDebateAssignments] = useState<DebateRoleAssignments>(
    INITIAL_DEBATE_ASSIGNMENTS,
  );
  const [attachments, setAttachments] = useState<WorkspaceAttachmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function ensureSessionId() {
    if (sessionIdRef.current) {
      return sessionIdRef.current;
    }

    const session = await inMemorySessionRepository.createSession({
      initialMode: mode,
    });
    sessionIdRef.current = session.id;
    return session.id;
  }

  const hasDuplicateDebateAssignments =
    mode === "debate" &&
    new Set(
      Object.values(debateAssignments).filter(
        (value): value is DebateModel => value !== "",
      ),
    ).size !== Object.values(debateAssignments).filter(Boolean).length;
  const hasIncompleteDebateAssignments =
    mode === "debate" &&
    Object.values(debateAssignments).some((value) => value === "");
  const readyAttachments = attachments.filter(
    (attachment) => attachment.status === "ready",
  );

  async function handleAttachmentSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);

    if (selectedFiles.length === 0) {
      return;
    }

    const parsedAttachments = await Promise.allSettled(
      selectedFiles.map(parseSelectedAttachmentFile),
    );

    const nextAttachments = parsedAttachments.map((result, index) =>
      result.status === "fulfilled"
        ? result.value
        : buildFallbackAttachmentErrorItem(selectedFiles[index]),
    );

    setAttachments((current) => [
      ...current,
      ...nextAttachments,
    ]);
    const sessionId = await ensureSessionId();
    for (const attachment of nextAttachments) {
      await inMemorySessionRepository.appendEntry({
        sessionId,
        type: "attachment_attached",
        mode,
        prompt: "",
        conversationState,
        attachmentContext: buildSessionAttachmentContext([attachment]),
      });
    }
    event.target.value = "";
  }

  async function handleAttachmentRemove(attachmentId: string) {
    const removedAttachment = attachments.find(
      (attachment) => attachment.id === attachmentId,
    );

    setAttachments((current) =>
      current.filter((attachment) => attachment.id !== attachmentId),
    );

    if (!removedAttachment) {
      return;
    }

    await inMemorySessionRepository.appendEntry({
      sessionId: await ensureSessionId(),
      type: "attachment_removed",
      mode,
      prompt: "",
      conversationState,
      attachmentContext: buildSessionAttachmentContext([removedAttachment]),
    });
  }

  async function handleRun(action: WorkspaceAction) {
    const trimmedInput = theme.trim();
    const isFinalizeAction = action === "finalize";
    const isSynthesisRequest =
      mode !== "debate" &&
      (isFinalizeAction || isExplicitSynthesisTrigger(trimmedInput, mode));
    const isJudgmentRequest =
      mode === "debate" &&
      (isFinalizeAction || isExplicitJudgmentTrigger(trimmedInput, mode));

    if (mode === "debate") {
      if (hasIncompleteDebateAssignments) {
        setError("ディベートを開始するには、賛成側・反対側・審判をすべて選択してください。");
        return;
      }

      if (hasDuplicateDebateAssignments) {
        setError("同じAIを複数のディベート役割に割り当てることはできません。");
        return;
      }

      if (isJudgmentRequest) {
        if (lastDiscussionMode !== "debate") {
          setError("先にディベートを開始してから判定してください。");
          return;
        }

        setError(null);
        setSubmittedPrompt(trimmedInput || DEFAULT_THEME);
        setConversationState("judged");
        await inMemorySessionRepository.appendEntry({
          sessionId: await ensureSessionId(),
          type: "judgment_requested",
          mode,
          prompt: trimmedInput || DEFAULT_THEME,
          conversationState: "judged",
        });
        return;
      }
    }

    if (isSynthesisRequest) {
      if (lastDiscussionMode !== mode) {
        setError("先にこのモードで議論を表示してから統合してください。");
        return;
      }

      setError(null);
      setSubmittedPrompt(trimmedInput || DEFAULT_THEME);
      setConversationState("synthesized");
      await inMemorySessionRepository.appendEntry({
        sessionId: await ensureSessionId(),
        type: "synthesis_requested",
        mode,
        prompt: trimmedInput,
        conversationState: "synthesized",
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/meeting/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          theme,
          mode,
          attachments: readyAttachments.map<MeetingAttachment>((attachment) => ({
            id: attachment.id,
            filename: attachment.filename,
            extension: attachment.extension,
            mimeType: attachment.mimeType,
            size: attachment.size,
            extractedText: attachment.extractedText,
            excerpt: attachment.excerpt,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("会議の生成に失敗しました。");
      }

      const nextResult = (await response.json()) as MeetingRunResult;
      setSubmittedPrompt(trimmedInput || DEFAULT_THEME);
      setResult(nextResult);
      setLastDiscussionMode(mode);
      const nextConversationState =
        mode === "brainstorm"
          ? "brainstorming"
          : mode === "debate"
            ? "awaiting_judgment"
            : "discussing";
      setConversationState(nextConversationState);
      await inMemorySessionRepository.appendEntry({
        sessionId: await ensureSessionId(),
        type: "meeting_generated",
        mode,
        prompt: trimmedInput || DEFAULT_THEME,
        conversationState: nextConversationState,
        attachmentContext: buildSessionAttachmentContext(readyAttachments),
      });
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "不明なエラーが発生しました。",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleModeChange(nextMode: MeetingMode) {
    setMode(nextMode);
    setConversationState(getInitialConversationState(nextMode));
    setError(null);
  }

  function handleDebateAssignmentChange(
    role: DebateRole,
    value: DebateModel | "",
  ) {
    setDebateAssignments((current) => ({
      ...current,
      [role]: value,
    }));
    setError(null);
  }

  const activeMode = MODE_OPTIONS.find((option) => option.value === mode) ?? MODE_OPTIONS[1];
  const activeState = buildConversationStateSnapshot(mode, conversationState);
  const stateCandidates = getAllowedStatesForMode(mode).map((state) =>
    buildConversationStateSnapshot(mode, state),
  );
  const activePlaceholder = PANEL_PLACEHOLDERS[mode];
  const hasSynthesis =
    mode !== "debate" && conversationState === "synthesized";
  const hasJudgment = mode === "debate" && conversationState === "judged";
  const canContinueDiscussion =
    !loading &&
    (mode !== "debate" ||
      (!hasIncompleteDebateAssignments && !hasDuplicateDebateAssignments));
  const canFinalizeDiscussion =
    !loading &&
    lastDiscussionMode === mode &&
    (mode !== "debate" ||
      (!hasIncompleteDebateAssignments && !hasDuplicateDebateAssignments));
  const actionLabels = pickActionLabels(mode);
  const debateAssignmentSummary = [
    `${DEBATE_ROLE_LABELS.pro}: ${pickModelLabel(debateAssignments.pro)}`,
    `${DEBATE_ROLE_LABELS.con}: ${pickModelLabel(debateAssignments.con)}`,
    `${DEBATE_ROLE_LABELS.judge}: ${pickModelLabel(debateAssignments.judge)}`,
  ].join("\n");
  const attachmentSummary =
    readyAttachments.length > 0
      ? readyAttachments.map((attachment) => `- ${attachment.filename}`).join("\n")
      : "";
  const debateAssignmentLabels = {
    pro: pickModelLabel(debateAssignments.pro),
    con: pickModelLabel(debateAssignments.con),
    judge: pickModelLabel(debateAssignments.judge),
  };
  const synthesisDisplay = buildSynthesisDisplay(result.synthesis);
  const debateJudgmentDisplay =
    mode === "debate" && result.debateJudgment
      ? buildDebateJudgmentDisplay(result.debateJudgment, debateAssignmentLabels)
      : null;

  const timelineEntries = buildTimelineEntries({
    mode,
    submittedPrompt,
    activeMode,
    activeState,
    debateAssignmentSummary,
    attachmentSummary,
    result,
    hasSynthesis,
    hasJudgment,
    synthesisDisplay,
    debateJudgmentDisplay,
  });

  return (
    <div className="grid gap-6 pb-8 xl:grid-cols-[minmax(0,1.35fr)_380px]">
      <TimelinePanel
        activeMode={activeMode}
        activeState={activeState}
        timelineEntries={timelineEntries}
        hasSynthesis={hasSynthesis}
        hasJudgment={hasJudgment}
        synthesisDisplay={synthesisDisplay}
        debateJudgmentDisplay={debateJudgmentDisplay}
      />

      <ControlSidebar
        theme={theme}
        onThemeChange={setTheme}
        mode={mode}
        onModeChange={handleModeChange}
        attachments={attachments}
        fileInputRef={fileInputRef}
        onAttachmentSelect={handleAttachmentSelection}
        onAttachmentRemove={handleAttachmentRemove}
        debateAssignments={debateAssignments}
        onDebateAssignmentChange={handleDebateAssignmentChange}
        loading={loading}
        actionLabels={actionLabels}
        canContinueDiscussion={canContinueDiscussion}
        canFinalizeDiscussion={canFinalizeDiscussion}
        hasIncompleteDebateAssignments={hasIncompleteDebateAssignments}
        hasDuplicateDebateAssignments={hasDuplicateDebateAssignments}
        onRun={handleRun}
        error={error}
        activeMode={activeMode}
        activeState={activeState}
        stateCandidates={stateCandidates}
        activePlaceholder={activePlaceholder}
        hasSynthesis={hasSynthesis}
        hasJudgment={hasJudgment}
        synthesisDisplay={synthesisDisplay}
        debateJudgmentDisplay={debateJudgmentDisplay}
        debateAssignmentLabels={debateAssignmentLabels}
        result={result}
      />
    </div>
  );
}
