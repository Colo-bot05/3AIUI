"use client";

import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";

import type { WorkspaceAttachmentItem } from "@/features/attachments/types";
import { DEFAULT_ROLE_PROMPTS } from "@/features/meeting/default-prompts";
import { MODE_OPTIONS } from "@/features/meeting/mode-config";
import {
  buildDebateJudgmentDisplay,
  buildSynthesisDisplay,
} from "@/features/meeting/presentation";
import {
  buildConversationStateSnapshot,
  getAllowedStatesForMode,
  getInitialConversationState,
} from "@/features/meeting/state";
import type {
  ConversationState,
  DebateModel,
  DebateRole,
  DebateRoleAssignments,
  MeetingAttachment,
  MeetingActionInput,
  MeetingActionResult,
  MeetingMode,
  MeetingRunResult,
  RolePrompts,
  SpeakerRole,
} from "@/features/meeting/types";
import { inMemorySessionRepository } from "@/lib/session/in-memory-session-repository";

import { ControlSidebar } from "./meeting-workspace/control-sidebar";
import { PromptSettingsPanel } from "./meeting-workspace/prompt-settings-panel";
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

const PROMPT_STORAGE_KEY = "meeting-workspace-role-prompts";

function loadRolePromptsFromStorage(): RolePrompts | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const stored = window.sessionStorage.getItem(PROMPT_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    const parsed = JSON.parse(stored) as Partial<RolePrompts>;
    if (
      parsed &&
      typeof parsed.vision === "string" &&
      typeof parsed.reality === "string" &&
      typeof parsed.audit === "string"
    ) {
      return {
        vision: parsed.vision,
        reality: parsed.reality,
        audit: parsed.audit,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function areRolePromptsEqual(left: RolePrompts, right: RolePrompts) {
  return (
    left.vision === right.vision &&
    left.reality === right.reality &&
    left.audit === right.audit
  );
}

function pickNextSpeaker(
  history: MeetingRunResult["responses"],
): Exclude<SpeakerRole, "audit"> {
  const spoken = history.filter(
    (entry) => entry.role === "vision" || entry.role === "reality",
  );
  return spoken.length % 2 === 0 ? "vision" : "reality";
}

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
  const [rolePrompts, setRolePrompts] = useState<RolePrompts>(DEFAULT_ROLE_PROMPTS);
  const [isPromptSettingsOpen, setIsPromptSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const stored = loadRolePromptsFromStorage();
    if (stored) {
      setRolePrompts(stored);
    }
  }, []);

  function handleSaveRolePrompts(next: RolePrompts) {
    setRolePrompts(next);
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.sessionStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // sessionStorage quota or disabled — state still updates.
    }
  }

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
  const readyAttachmentsForApi = readyAttachments.map<MeetingAttachment>(
    (attachment) => ({
      id: attachment.id,
      filename: attachment.filename,
      extension: attachment.extension,
      mimeType: attachment.mimeType,
      size: attachment.size,
      extractedText: attachment.extractedText,
      excerpt: attachment.excerpt,
    }),
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

    setAttachments((current) => [...current, ...nextAttachments]);
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

  async function postMeetingAction(
    payload: MeetingActionInput,
  ): Promise<MeetingActionResult> {
    const response = await fetch("/api/meeting/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error("会議の生成に失敗しました。");
    }
    return (await response.json()) as MeetingActionResult;
  }

  async function handleRun(action: WorkspaceAction) {
    const freshRolePrompts = loadRolePromptsFromStorage() ?? rolePrompts;
    if (!areRolePromptsEqual(freshRolePrompts, rolePrompts)) {
      setRolePrompts(freshRolePrompts);
    }

    const trimmedInput = theme.trim();
    const normalizedPrompt = trimmedInput || DEFAULT_THEME;
    const isFinalizeAction = action === "finalize";

    if (mode === "debate") {
      if (hasIncompleteDebateAssignments) {
        setError("ディベートを開始するには、賛成側・反対側・審判をすべて選択してください。");
        return;
      }
      if (hasDuplicateDebateAssignments) {
        setError("同じAIを複数のディベート役割に割り当てることはできません。");
        return;
      }
    }

    if (isFinalizeAction) {
      if (result.responses.length === 0) {
        setError(
          mode === "debate"
            ? "先にディベートを開始してから判定してください。"
            : "先にこのモードで議論を表示してから統合してください。",
        );
        return;
      }
      if (lastDiscussionMode !== mode) {
        setError(
          mode === "debate"
            ? "先にディベートを開始してから判定してください。"
            : "先にこのモードで議論を表示してから統合してください。",
        );
        return;
      }

      setLoading(true);
      setError(null);
      try {
        if (mode === "debate") {
          const payload: MeetingActionInput = {
            action: "judge",
            theme,
            mode,
            attachments: readyAttachmentsForApi,
            rolePrompts: freshRolePrompts,
            history: result.responses,
            debateAssignmentLabels: {
              pro: pickModelLabel(debateAssignments.pro),
              con: pickModelLabel(debateAssignments.con),
              judge: pickModelLabel(debateAssignments.judge),
            },
          };
          const response = await postMeetingAction(payload);
          if (response.action !== "judge") {
            throw new Error("Unexpected response shape for judge action.");
          }
          setSubmittedPrompt(normalizedPrompt);
          setResult((prev) => ({
            ...prev,
            debateJudgment: response.debateJudgment,
            generatedAt: new Date().toISOString(),
          }));
          setConversationState("judged");
          await inMemorySessionRepository.appendEntry({
            sessionId: await ensureSessionId(),
            type: "judgment_requested",
            mode,
            prompt: normalizedPrompt,
            conversationState: "judged",
          });
        } else {
          const payload: MeetingActionInput = {
            action: "synthesize",
            theme,
            mode,
            attachments: readyAttachmentsForApi,
            rolePrompts: freshRolePrompts,
            history: result.responses,
          };
          const response = await postMeetingAction(payload);
          if (response.action !== "synthesize") {
            throw new Error("Unexpected response shape for synthesize action.");
          }
          setSubmittedPrompt(normalizedPrompt);
          setResult((prev) => ({
            ...prev,
            synthesis: response.synthesis,
            generatedAt: new Date().toISOString(),
          }));
          setConversationState("synthesized");
          await inMemorySessionRepository.appendEntry({
            sessionId: await ensureSessionId(),
            type: "synthesis_requested",
            mode,
            prompt: trimmedInput,
            conversationState: "synthesized",
          });
        }
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "不明なエラーが発生しました。",
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    // action === "continue"
    const nextSpeaker = pickNextSpeaker(result.responses);
    setLoading(true);
    setError(null);
    try {
      const payload: MeetingActionInput = {
        action: "continue",
        theme,
        mode,
        attachments: readyAttachmentsForApi,
        rolePrompts: freshRolePrompts,
        history: result.responses,
        nextSpeaker,
      };
      const response = await postMeetingAction(payload);
      if (response.action !== "continue") {
        throw new Error("Unexpected response shape for continue action.");
      }
      setSubmittedPrompt(normalizedPrompt);
      setResult((prev) => ({
        ...prev,
        theme: normalizedPrompt,
        mode,
        responses: [...prev.responses, response.turn],
        generatedAt: new Date().toISOString(),
      }));
      setLastDiscussionMode(mode);
      const nextConversationState: ConversationState =
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
        prompt: normalizedPrompt,
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
    setResult((prev) => ({
      theme: prev.theme,
      mode: nextMode,
      responses: [],
      generatedAt: new Date().toISOString(),
    }));
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
    result.responses.length > 0 &&
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
  const synthesisDisplay = result.synthesis
    ? buildSynthesisDisplay(result.synthesis)
    : null;
  const debateJudgmentDisplay =
    mode === "debate" && result.debateJudgment
      ? buildDebateJudgmentDisplay(result.debateJudgment, debateAssignmentLabels)
      : null;
  const nextSpeakerRole: Exclude<SpeakerRole, "audit"> | null =
    hasSynthesis || hasJudgment ? null : pickNextSpeaker(result.responses);
  const nextSpeakerLabel = nextSpeakerRole
    ? nextSpeakerRole === "vision"
      ? "構想AI"
      : "現実AI"
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
        nextSpeakerLabel={nextSpeakerLabel}
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
        onOpenPromptSettings={() => setIsPromptSettingsOpen(true)}
      />

      {isPromptSettingsOpen ? (
        <PromptSettingsPanel
          onClose={() => setIsPromptSettingsOpen(false)}
          currentPrompts={rolePrompts}
          onSave={handleSaveRolePrompts}
        />
      ) : null}
    </div>
  );
}
