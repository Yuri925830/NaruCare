import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, ArrowRight, BadgeCheck, CalendarCheck2, CalendarOff, CarFront, Check, Clock3, Copy, Languages, LocateFixed, Map, MapPin, Mic, Navigation, Pencil, Send, ShieldCheck, Square, Star, Stethoscope, Trash2, UserRound, Volume2 } from "lucide-react";
import { api } from "../api";
import { verifyAgentToolCall, type AgentJourneyObservation } from "../agentWorkflow";
import { findAppointmentSlotFromText, parseAppointmentPreference } from "../appointmentConversation";
import { companionFlowCopy } from "../companionFlow";
import { conversationCopy } from "../conversationCopy";
import { hospitalAppointmentCopy } from "../hospitalAppointmentCopy";
import {
  appointmentAvailabilityFor,
  appointmentPolicyFor,
  type AppointmentDecision,
  type AppointmentPreference,
  type HospitalAppointmentAvailability,
  type HospitalAppointmentBooking,
  type HospitalAppointmentSlot,
} from "../hospitalAppointments";
import { Button, InfoBanner, InteractiveMap, LocationPickerMap, NaruPose, NaverNavigationMap, Panel, StatusPill, VisitJourneyProgress } from "../components";
import { hospitalDemoInsightFor, hospitalDemoLabels, hospitalDemoText } from "../hospitalDemoInsights";
import { evaluateOpeningHours, formatOpeningSchedule, formatRestDays } from "../hospitalHours";
import { localeOptions, useI18n } from "../i18n";
import {
  MEDICAL_CARD_CHAT_STEPS,
  applyMedicalCardChatAnswer,
  createMedicalCardChatDraft,
  isMedicalCardCancelAnswer,
  maskMedicalCardChatValue,
  medicalCardConversationCopy,
  parseMedicalCardChatAnswer,
  type MedicalCardAnswerError,
  type MedicalCardChatField,
} from "../medicalCardConversation";
import { assessMedicalIntent, extractReportableSymptoms, isAffirmativeResponse, isNaruCapabilityQuestion, isNaruIdentityQuestion, isNegativeResponse, isSymptomsResolvedStatement } from "../triage";
import type { ChatHistoryEntry, Hospital, LocationState, MedicalCard, MedicalEvidenceSource, TranslationRecordEntry } from "../types";
import {
  companionDecisionFromText,
  journeyChatActionFromText,
  visitJourneyStepIndex,
  type CompanionDecision,
  type JourneyChatAction,
  type VisitJourneyStep,
} from "../visitJourney";

interface Message { id: string; role: "naru" | "user" | "status"; text: string; detail?: string; sources?: MedicalEvidenceSource[] }

interface MedicalCardChatState {
  draft: MedicalCard;
  stepIndex: number;
  phase: "collect" | "review" | "saving";
  returnToReview: boolean;
}

function InlineMessageText({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith("**") && part.endsWith("**")
    ? <strong key={`${index}-${part}`}>{part.slice(2, -2)}</strong>
    : part)}</>;
}

function WelcomeMessage({ text }: { text: string }) {
  const blocks = text.trim().split(/\n\s*\n/);
  return <div className="welcome-message" dir="auto">
    {blocks.map((block, index) => {
      const key = `${index}-${block.slice(0, 18)}`;
      if (block === "---") return <hr key={key} />;
      if (block.startsWith("### ")) return <h3 key={key}><InlineMessageText text={block.slice(4)} /></h3>;
      if (block.startsWith("## ")) return <h2 key={key}><InlineMessageText text={block.slice(3)} /></h2>;
      return <p key={key}><InlineMessageText text={block} /></p>;
    })}
  </div>;
}

export function AgentPage({
  card, symptoms, hospitalResultCount, hospitalConfirmed, journeyStep, companionDecision, selectedHospital, appointmentPreference, appointmentDecision,
  onCard, onSaveCard, onEmergency, onHospitals, onSymptoms, onSymptomsResolved, onCompanion,
  onCompanionDecision, onAppointmentPreference, onBookAppointment, onSkipAppointment,
  onOpenAppointments, onFlow, onTranslation, onArrived, onCompleteVisit, onJourneyStep, onRestartJourney, onRecords, gateSignal,
}: {
  card: MedicalCard | null;
  symptoms: string;
  hospitalResultCount: number;
  hospitalConfirmed: boolean;
  journeyStep: VisitJourneyStep;
  companionDecision: CompanionDecision;
  selectedHospital: Hospital | null;
  appointmentPreference: AppointmentPreference;
  appointmentDecision: AppointmentDecision;
  onCard: () => void;
  onSaveCard: (card: MedicalCard) => Promise<MedicalCard>;
  onEmergency: (symptoms: string) => void;
  onHospitals: (symptoms: string) => void | Promise<void>;
  onSymptoms?: (symptoms: string) => void | Promise<void>;
  onSymptomsResolved?: () => void | Promise<void>;
  onCompanion: () => void;
  onCompanionDecision: (decision: Exclude<CompanionDecision, "pending">) => void;
  onAppointmentPreference: (preference: AppointmentPreference) => void;
  onBookAppointment: (slot: HospitalAppointmentSlot) => void;
  onSkipAppointment: () => void;
  onOpenAppointments: () => void;
  onFlow?: () => void;
  onTranslation?: () => void;
  onArrived: () => void;
  onCompleteVisit: () => void | Promise<void>;
  onJourneyStep: (step: VisitJourneyStep) => void;
  onRestartJourney: () => void;
  onRecords: () => void;
  gateSignal?: number;
}) {
  const { locale, t } = useI18n();
  const companionFlow = companionFlowCopy(locale);
  const conversation = conversationCopy(locale);
  const appointmentFlow = hospitalAppointmentCopy(locale);
  const medicalCardFlow = medicalCardConversationCopy(locale);
  const [messages, setMessages] = useState<Message[]>([{ id: "welcome", role: "naru", text: t("universalGreeting") }]);
  const [input, setInput] = useState("");
  const [gate, setGate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [pendingHospitalSymptoms, setPendingHospitalSymptoms] = useState<string | null>(null);
  const [medicalCardChat, setMedicalCardChat] = useState<MedicalCardChatState | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousJourneyStep = useRef(journeyStep);
  const medicalCardFieldLabels = useMemo<Record<MedicalCardChatField, string>>(() => ({
    name: t("name"),
    nationality: t("nationality"),
    age: t("age"),
    gender: t("gender"),
    language: t("primaryLanguage"),
    documentType: t("documentType"),
    documentNumber: t("documentNumber"),
    insurance: t("insurance"),
    address: t("residentialAddress"),
    conditions: t("conditions"),
    medications: t("medications"),
    surgeries: t("surgeries"),
    symptoms: t("currentSymptoms"),
    notes: t("notes"),
  }), [t]);
  const currentMedicalCardStep = medicalCardChat?.phase === "collect"
    ? MEDICAL_CARD_CHAT_STEPS[medicalCardChat.stepIndex]
    : null;
  const medicalCardChoiceOptions = useMemo(() => {
    if (!currentMedicalCardStep) return [] as { value: string; label: string }[];
    if (currentMedicalCardStep.kind === "gender") return [
      { value: "female", label: t("female") },
      { value: "male", label: t("male") },
      { value: "other", label: t("other") },
    ];
    if (currentMedicalCardStep.kind === "document") return [
      { value: "alien", label: t("alienRegistration") },
      { value: "passport", label: t("passport") },
    ];
    if (currentMedicalCardStep.kind === "insurance") return [
      { value: "yes", label: t("yes") },
      { value: "no", label: t("no") },
    ];
    if (currentMedicalCardStep.kind === "language") {
      return [...new Set([locale, "ko", "en", "zh-CN", "ja"])]
        .map((code) => localeOptions.find((option) => option.code === code))
        .filter((option): option is (typeof localeOptions)[number] => Boolean(option))
        .map((option) => ({ value: option.code, label: `${option.badge} ${option.nativeName}` }));
    }
    return [] as { value: string; label: string }[];
  }, [currentMedicalCardStep, locale, t]);
  const chatAppointmentAvailability = useMemo(
    () => journeyStep === "appointment" && selectedHospital
      ? appointmentAvailabilityFor(selectedHospital, appointmentPreference)
      : null,
    [appointmentPreference, journeyStep, selectedHospital],
  );
  const agentObservation = useMemo<AgentJourneyObservation>(() => ({
    journeyStep,
    hasCard: Boolean(card),
    symptoms: extractReportableSymptoms(symptoms || card?.symptoms || ""),
    hospitalResultCount,
    selectedHospital: selectedHospital?.name || "",
    hospitalConfirmed,
    appointmentDecision,
    appointmentCanSkip: Boolean(chatAppointmentAvailability && chatAppointmentAvailability.policy !== "required"),
    appointmentSlotCount: chatAppointmentAvailability?.matchingSlots.length || 0,
    companionDecision,
    preparationComplete: visitJourneyStepIndex(journeyStep) >= visitJourneyStepIndex("navigation"),
    arrived: visitJourneyStepIndex(journeyStep) >= visitJourneyStepIndex("translation"),
    translationActive: journeyStep === "translation",
  }), [appointmentDecision, card, chatAppointmentAvailability, companionDecision, hospitalConfirmed, hospitalResultCount, journeyStep, selectedHospital, symptoms]);
  const formatAppointmentDate = useCallback(
    (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString(locale, { month: "short", day: "numeric", weekday: "short" }),
    [locale],
  );
  const currentJourneyPrompt = useCallback(() => {
    if (journeyStep === "symptoms") return t("journeyNeedSymptoms");
    if (journeyStep === "hospital") return t("journeyHospitalPrompt");
    if (journeyStep === "appointment") return appointmentFlow.journeyPrompt;
    if (journeyStep === "companion") return companionFlow.journeyPrompt;
    if (journeyStep === "prepare") return t("journeyPreparePrompt");
    if (journeyStep === "navigation") return t("journeyNavigationPrompt");
    if (journeyStep === "translation") return t("journeyTranslationPrompt");
    return t("journeyCompletePrompt");
  }, [appointmentFlow.journeyPrompt, companionFlow.journeyPrompt, journeyStep, t]);
  const openCurrentJourneyStep = useCallback((symptomsOverride = "") => {
    if (journeyStep === "symptoms") {
      inputRef.current?.focus();
      return;
    }
    if (journeyStep === "hospital") {
      const currentSymptoms = extractReportableSymptoms(symptomsOverride) || extractReportableSymptoms(card?.symptoms || "");
      void onHospitals(currentSymptoms);
      return;
    }
    if (journeyStep === "appointment") {
      onOpenAppointments();
      return;
    }
    if (journeyStep === "prepare") {
      onFlow?.();
      return;
    }
    if (journeyStep === "navigation") {
      onJourneyStep("navigation");
      return;
    }
    if (journeyStep === "translation") onTranslation?.();
  }, [card?.symptoms, journeyStep, onFlow, onHospitals, onJourneyStep, onOpenAppointments, onTranslation]);

  useEffect(() => {
    setMessages((current) => current[0]?.id === "welcome"
      ? [{ ...current[0], text: t("universalGreeting") }, ...current.slice(1)]
      : current);
  }, [locale, t]);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    void api.chatHistory()
      .then((history) => {
        if (cancelled || !history.length) return;
        const restored = history.map<Message>((entry) => ({
          id: crypto.randomUUID(),
          role: entry.role === "user" ? "user" : "naru",
          text: entry.content,
        }));
        setMessages((current) => current[0]?.id === "welcome"
          ? [current[0], ...restored, ...current.slice(1)]
          : [...restored, ...current]);
      })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { if (!card && gateSignal) setGate(true); }, [card, gateSignal]);
  useEffect(() => { if (card) setGate(false); }, [card]);
  useEffect(() => {
    if (previousJourneyStep.current === journeyStep) return;
    previousJourneyStep.current = journeyStep;
    const promptKey: Partial<Record<VisitJourneyStep, Parameters<typeof t>[0]>> = {
      hospital: "journeyHospitalPrompt",
      prepare: "journeyPreparePrompt",
      navigation: "journeyNavigationPrompt",
      translation: "journeyTranslationPrompt",
      complete: "journeyCompletePrompt",
    };
    if (journeyStep === "appointment") {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: appointmentFlow.journeyPrompt }]);
      return;
    }
    if (journeyStep === "companion") {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: companionFlow.journeyPrompt }]);
      return;
    }
    const key = promptKey[journeyStep];
    if (key) setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: t(key) }]);
  }, [appointmentFlow.journeyPrompt, companionFlow.journeyPrompt, journeyStep, t]);
  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;
    if (messages.length === 1 && messages[0]?.id === "welcome") {
      container.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const completeCompanionDecision = (decision: Exclude<CompanionDecision, "pending">, showChoice: boolean) => {
    const choice = decision === "use" ? companionFlow.useCompanion : companionFlow.skipCompanion;
    const reply = decision === "use" ? companionFlow.useConfirmed : companionFlow.skipConfirmed;
    setMessages((current) => [
      ...current,
      ...(showChoice ? [{ id: crypto.randomUUID(), role: "user" as const, text: choice }] : []),
      { id: crypto.randomUUID(), role: "naru", text: reply },
    ]);
    void api.rememberChat(choice, reply, "companion");
    onCompanionDecision(decision);
  };

  const completeAppointmentBooking = (slot: HospitalAppointmentSlot, showChoice: boolean) => {
    if (!selectedHospital) return;
    const choice = `${formatAppointmentDate(slot.date)} ${slot.startTime}–${slot.endTime}`;
    const reply = appointmentFlow.chatBooked
      .replace("{hospital}", selectedHospital.name)
      .replace("{date}", formatAppointmentDate(slot.date))
      .replace("{time}", `${slot.startTime}–${slot.endTime}`);
    setMessages((current) => [
      ...current,
      ...(showChoice ? [{ id: crypto.randomUUID(), role: "user" as const, text: choice }] : []),
      { id: crypto.randomUUID(), role: "naru", text: reply },
    ]);
    void api.rememberChat(choice, reply, "appointment");
    onBookAppointment(slot);
  };

  const completeAppointmentSkip = (showChoice: boolean) => {
    if (!selectedHospital || !chatAppointmentAvailability) return;
    if (chatAppointmentAvailability.policy === "required") {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: appointmentFlow.chatRequiredCannotSkip }]);
      return;
    }
    const choice = chatAppointmentAvailability.policy === "walk_in"
      ? appointmentFlow.continueWalkIn
      : appointmentFlow.continueWithoutBooking;
    setMessages((current) => [
      ...current,
      ...(showChoice ? [{ id: crypto.randomUUID(), role: "user" as const, text: choice }] : []),
      { id: crypto.randomUUID(), role: "naru", text: appointmentFlow.chatSkipConfirmed },
    ]);
    void api.rememberChat(choice, appointmentFlow.chatSkipConfirmed, "appointment");
    onSkipAppointment();
  };

  const clearConversation = async () => {
    if (clearingHistory || !window.confirm(conversation.clearConfirm)) return;
    setClearingHistory(true);
    try {
      const cleared = await api.clearChatHistory();
      if (!cleared) {
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: conversation.clearFailed }]);
        return;
      }
      setPendingHospitalSymptoms(null);
      setMedicalCardChat(null);
      setMessages([
        { id: "welcome", role: "naru", text: t("universalGreeting") },
        { id: crypto.randomUUID(), role: "status", text: conversation.cleared },
      ]);
    } finally {
      setClearingHistory(false);
    }
  };

  const medicalCardErrorText = (error: MedicalCardAnswerError) => {
    if (error === "invalidAge") return medicalCardFlow.ageError;
    if (error === "invalidChoice") return medicalCardFlow.choiceError;
    return medicalCardFlow.requiredError;
  };

  const startMedicalCardCreation = (sourceText = medicalCardFlow.startAction, showChoice = true) => {
    if (card) {
      onCard();
      return;
    }
    setGate(false);
    setInput("");
    setMedicalCardChat({
      draft: createMedicalCardChatDraft(locale),
      stepIndex: 0,
      phase: "collect",
      returnToReview: false,
    });
    setMessages((current) => [
      ...current,
      ...(showChoice ? [{ id: crypto.randomUUID(), role: "user" as const, text: sourceText }] : []),
      { id: crypto.randomUUID(), role: "naru", text: medicalCardFlow.start },
    ]);
    void api.rememberChat(sourceText, medicalCardFlow.start, "card");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const cancelMedicalCardCreation = (userText?: string) => {
    setMedicalCardChat(null);
    setInput("");
    setMessages((current) => [
      ...current,
      ...(userText ? [{ id: crypto.randomUUID(), role: "user" as const, text: userText }] : []),
      { id: crypto.randomUUID(), role: "naru", text: medicalCardFlow.cancelled },
    ]);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const answerMedicalCardQuestion = (answer: string, displayAnswer = answer) => {
    const current = medicalCardChat;
    if (!current || current.phase !== "collect") return;
    if (isMedicalCardCancelAnswer(answer)) {
      cancelMedicalCardCreation(displayAnswer);
      return;
    }
    const step = MEDICAL_CARD_CHAT_STEPS[current.stepIndex];
    if (!step) return;
    const visibleAnswer = step.key === "documentNumber"
      ? maskMedicalCardChatValue(step.key, displayAnswer)
      : displayAnswer;
    setMessages((messages) => [...messages, { id: crypto.randomUUID(), role: "user", text: visibleAnswer }]);
    const parsed = parseMedicalCardChatAnswer(step, answer);
    if (!parsed.ok) {
      setMessages((messages) => [...messages, { id: crypto.randomUUID(), role: "naru", text: medicalCardErrorText(parsed.error) }]);
      window.setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }
    const draft = applyMedicalCardChatAnswer(current.draft, step.key, parsed.value);
    if (current.returnToReview || current.stepIndex >= MEDICAL_CARD_CHAT_STEPS.length - 1) {
      setMedicalCardChat({ draft, stepIndex: current.stepIndex, phase: "review", returnToReview: false });
      return;
    }
    setMedicalCardChat({ ...current, draft, stepIndex: current.stepIndex + 1 });
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const editMedicalCardField = (stepIndex: number) => {
    setMedicalCardChat((current) => current ? { ...current, stepIndex, phase: "collect", returnToReview: true } : current);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const saveMedicalCardFromChat = async () => {
    const current = medicalCardChat;
    if (!current || current.phase !== "review" || busy) return;
    setMedicalCardChat({ ...current, phase: "saving" });
    setBusy(true);
    try {
      await onSaveCard(current.draft);
      setMedicalCardChat(null);
      setMessages((messages) => [...messages, { id: crypto.randomUUID(), role: "naru", text: medicalCardFlow.saved }]);
      void api.rememberChat(medicalCardFlow.startAction, medicalCardFlow.saved, "card");
    } catch {
      setMedicalCardChat({ ...current, phase: "review" });
      setMessages((messages) => [...messages, { id: crypto.randomUUID(), role: "naru", text: medicalCardFlow.saveError }]);
    } finally {
      setBusy(false);
    }
  };

  const displayMedicalCardValue = (field: MedicalCardChatField, value: string) => {
    if (!value) return medicalCardFlow.emptyValue;
    if (field === "gender") return value === "female" ? t("female") : value === "male" ? t("male") : t("other");
    if (field === "documentType") return value === "alien" ? t("alienRegistration") : t("passport");
    if (field === "insurance") return value === "yes" ? t("yes") : t("no");
    if (field === "language") return localeOptions.find((option) => option.code === value)?.nativeName || value;
    return maskMedicalCardChatValue(field, value);
  };

  const performJourneyAction = async (
    action: JourneyChatAction,
    modelReply: string,
    confidence: "high" | "medium" | "low",
    deterministicFallback = false,
    actionSymptoms = "",
  ) => {
    const verification = verifyAgentToolCall(agentObservation, action, deterministicFallback ? "high" : confidence);
    if (verification.status === "blocked" || verification.acceptedAction !== action) return false;

    const reply = action === "explain_current_step" && modelReply.trim()
      ? modelReply.trim()
      : action === "change_hospital"
        ? t("journeyHospitalPrompt")
        : action === "confirm_arrival"
          ? t("journeyTranslationPrompt")
          : action === "complete_visit"
            ? t("journeyCompletePrompt")
            : currentJourneyPrompt();
    if (action === "explain_current_step") {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: reply }]);
      window.setTimeout(() => inputRef.current?.focus(), 0);
      return true;
    }
    if (action === "skip_appointment") {
      completeAppointmentSkip(false);
      return true;
    }
    if (action === "use_companion" || action === "skip_companion") {
      completeCompanionDecision(action === "use_companion" ? "use" : "skip", false);
      return true;
    }
    if (action === "change_hospital") {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: reply }]);
      setBusy(true);
      const currentSymptoms = extractReportableSymptoms(actionSymptoms) || extractReportableSymptoms(card?.symptoms || "");
      try { await onHospitals(currentSymptoms); }
      finally { setBusy(false); }
      return true;
    }
    if (action === "confirm_arrival") {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: reply }]);
      onArrived();
      return true;
    }
    if (action === "complete_visit") {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: reply }]);
      await onCompleteVisit();
      return true;
    }
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: reply }]);
    openCurrentJourneyStep(actionSymptoms);
    return true;
  };

  const send = async (text = input) => {
    const clean = text.trim();
    if (!clean || busy || historyLoading || clearingHistory) return;
    setInput("");
    if (medicalCardChat?.phase === "collect") {
      answerMedicalCardQuestion(clean);
      return;
    }
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: clean }]);
    const cardIntent = /(就诊卡|診療カード|medical card|진료카드|create.*card|建卡)/i.test(clean);
    if (!card && cardIntent) { startMedicalCardCreation(clean, false); return; }
    if (!card) {
      const reply = t("cardRequired");
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: reply }]);
      void api.rememberChat(clean, reply, "card");
      setGate(true);
      return;
    }
    if (isNaruIdentityQuestion(clean)) {
      const reply = `💙 ${t("naruIdentityAnswer")} 😊`;
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: reply }]);
      void api.rememberChat(clean, reply, "general");
      return;
    }
    if (isNaruCapabilityQuestion(clean)) {
      const reply = `😊 ${t("naruCapabilitiesAnswer")} 💙`;
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: reply }]);
      void api.rememberChat(clean, reply, "general");
      return;
    }
    if (journeyStep === "appointment" && selectedHospital && chatAppointmentAvailability) {
      const wantsToSkip = /예약\s*(?:안|없이|건너)|예약하지|현장\s*(?:접수|등록)|skip|without\s+(?:an?\s+)?appointment|walk[\s-]?in|不预约|不預約|现场挂号|現場掛號/i.test(clean);
      if (wantsToSkip) {
        completeAppointmentSkip(false);
        return;
      }

      const parsed = parseAppointmentPreference(clean, appointmentPreference);
      const nextPreference = parsed?.preference || appointmentPreference;
      const nextAvailability = parsed
        ? appointmentAvailabilityFor(selectedHospital, nextPreference)
        : chatAppointmentAvailability;
      const wantsToBook = /예약\s*(?:해|할|로|으로|확정)|예약할게|예약해줘|\bbook\b|\bconfirm(?:\s+the)?\s+appointment\b|预约|預約|挂号|掛號/i.test(clean);
      if (wantsToBook) {
        const slot = findAppointmentSlotFromText(clean, nextAvailability.matchingSlots)
          || (!parsed && nextAvailability.matchingSlots.length === 1 ? nextAvailability.matchingSlots[0] : null);
        if (parsed) onAppointmentPreference(nextPreference);
        if (slot) {
          completeAppointmentBooking(slot, false);
          return;
        }
        const reply = nextAvailability.matchingSlots.length
          ? appointmentFlow.chatNeedChoice
          : nextAvailability.policy === "walk_in"
            ? appointmentFlow.chatWalkIn
            : appointmentFlow.chatNoMatch;
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: reply }]);
        void api.rememberChat(clean, reply, "appointment");
        return;
      }

      if (parsed) {
        onAppointmentPreference(nextPreference);
        const summary = appointmentFlow.chatPreferenceUpdated
          .replace("{date}", formatAppointmentDate(nextPreference.date))
          .replace("{start}", nextPreference.startTime)
          .replace("{end}", nextPreference.endTime);
        const availabilityReply = nextAvailability.policy === "walk_in"
          ? appointmentFlow.chatWalkIn
          : nextAvailability.matchingSlots.length
            ? appointmentFlow.chatSlotsReady.replace("{count}", String(nextAvailability.matchingSlots.length))
            : appointmentFlow.chatNoMatch;
        const reply = `${summary} ${availabilityReply}`;
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: reply }]);
        void api.rememberChat(clean, reply, "appointment");
        return;
      }

      if (/예약|appointment|booking|预约|預約|挂号|掛號/i.test(clean)) {
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: appointmentFlow.chatNeedChoice }]);
        return;
      }
    }
    if (journeyStep === "companion" && companionDecision === "pending") {
      const typedDecision = companionDecisionFromText(clean)
        || (isAffirmativeResponse(clean) ? "use" : isNegativeResponse(clean) ? "skip" : null);
      if (typedDecision) {
        completeCompanionDecision(typedDecision, false);
        return;
      }
    }
    const heuristicJourneyAction = journeyChatActionFromText(journeyStep, clean);
    if (isSymptomsResolvedStatement(clean)) {
      setPendingHospitalSymptoms(null);
      await onSymptomsResolved?.();
      const reply = `🌿 ${t("symptomsResolvedReply")} 💙`;
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: reply }]);
      void api.rememberChat(clean, reply, "recovery");
      return;
    }
    if (pendingHospitalSymptoms !== null && isAffirmativeResponse(clean)) {
      const confirmedSymptoms = pendingHospitalSymptoms;
      setPendingHospitalSymptoms(null);
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "status", text: t("nearbyHospitals"), detail: confirmedSymptoms || t("nearbyAccepting") }]);
      void api.rememberChat(clean, `${t("nearbyHospitals")}: ${confirmedSymptoms || t("nearbyAccepting")}`, "hospital");
      setBusy(true);
      try { await onHospitals(confirmedSymptoms); }
      finally { setBusy(false); }
      return;
    }
    if (pendingHospitalSymptoms !== null && isNegativeResponse(clean)) {
      setPendingHospitalSymptoms(null);
      const reply = `🌿 ${t("hospitalOfferDeclined")}`;
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: reply }]);
      void api.rememberChat(clean, reply, "hospital");
      return;
    }
    const history: ChatHistoryEntry[] = messages
      .filter((message) => message.role !== "status" && message.id !== "welcome")
      .map((message) => ({ role: message.role === "user" ? "user" : "assistant", content: message.text }));
    const previousUserMessages = history.filter((message) => message.role === "user").map((message) => message.content);
    const localTriage = assessMedicalIntent(clean, previousUserMessages, true);
    const reportedSymptoms = extractReportableSymptoms(localTriage.symptoms || "");
    const effectiveEmergencySymptoms = reportedSymptoms || extractReportableSymptoms(card.symptoms || "") || extractReportableSymptoms(clean);
    if (localTriage.reason === "symptoms" && reportedSymptoms) await onSymptoms?.(reportedSymptoms);
    if (localTriage.intent === "emergency") {
      if (localTriage.symptoms) await onSymptoms?.(localTriage.symptoms);
      setPendingHospitalSymptoms(null);
      void api.rememberChat(clean, "", "emergency");
      onEmergency(effectiveEmergencySymptoms);
      return;
    }
    if (localTriage.intent === "card") {
      if (card) { void api.rememberChat(clean, "", "card"); onCard(); }
      else startMedicalCardCreation(clean, false);
      return;
    }
    if (localTriage.intent === "companion") {
      if (journeyStep === "companion" && companionDecision === "pending") completeCompanionDecision("use", false);
      else { void api.rememberChat(clean, "", "companion"); onCompanion(); }
      return;
    }
    if (localTriage.intent === "hospital" && localTriage.reason === "hospital_request") {
      if (visitJourneyStepIndex(journeyStep) >= visitJourneyStepIndex("appointment") && journeyStep !== "complete") {
        const reply = currentJourneyPrompt();
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: reply }]);
        void api.rememberChat(clean, reply, journeyStep);
        openCurrentJourneyStep();
        return;
      }
      if (!reportedSymptoms) {
        setPendingHospitalSymptoms(null);
        const reply = t("journeyNeedSymptoms");
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: reply }]);
        void api.rememberChat(clean, reply, "hospital");
        window.setTimeout(() => inputRef.current?.focus(), 0);
        return;
      }
      if (localTriage.symptoms) await onSymptoms?.(localTriage.symptoms);
      setPendingHospitalSymptoms(null);
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "status", text: t("nearbyHospitals"), detail: reportedSymptoms || t("nearbyAccepting") }]);
      void api.rememberChat(clean, `${t("nearbyHospitals")}: ${reportedSymptoms || t("nearbyAccepting")}`, "hospital");
      setBusy(true);
      try { await onHospitals(reportedSymptoms); }
      finally { setBusy(false); }
      return;
    }
    setBusy(true);
    try {
      const response = await api.chat(clean, locale, true, history, {
        ...agentObservation,
      });
      const responseSymptoms = extractReportableSymptoms(response.symptoms || reportedSymptoms);
      if ((response.intent === "hospital" || response.intent === "emergency") && responseSymptoms) await onSymptoms?.(responseSymptoms);
      if (response.intent === "recovery" || response.symptomStatus === "resolved") {
        setPendingHospitalSymptoms(null);
        await onSymptomsResolved?.();
        const reply = response.reply || `🌿 ${t("symptomsResolvedReply")} 💙`;
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: reply }]);
        return;
      }
      if (response.intent === "emergency") {
        setPendingHospitalSymptoms(null);
        return onEmergency(responseSymptoms || extractReportableSymptoms(card.symptoms || "") || extractReportableSymptoms(clean));
      }
      const modelAction: JourneyChatAction | null = response.action && response.action !== "none" ? response.action : null;
      const fallbackAction = response.reasoningTier === "fallback" ? heuristicJourneyAction : null;
      const requestedAction = modelAction || fallbackAction;
      if (requestedAction) {
        const handled = await performJourneyAction(
          requestedAction,
          response.reply,
          response.confidence || "low",
          Boolean(!modelAction && fallbackAction),
          responseSymptoms,
        );
        if (handled) return;
        const stepPrompt = currentJourneyPrompt();
        const reply = response.reply && response.reply !== stepPrompt ? `${response.reply}\n\n${stepPrompt}` : stepPrompt;
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: reply }]);
        return;
      }
      if (response.intent === "hospital") {
        if (visitJourneyStepIndex(journeyStep) >= visitJourneyStepIndex("appointment") && journeyStep !== "complete") {
          const stepPrompt = currentJourneyPrompt();
          const reply = response.reply && response.reply !== stepPrompt ? `${response.reply}\n\n${stepPrompt}` : stepPrompt;
          setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: reply }]);
          void api.rememberChat(clean, reply, journeyStep);
          return;
        }
        if (!responseSymptoms) {
          setPendingHospitalSymptoms(null);
          setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: t("journeyNeedSymptoms") }]);
          window.setTimeout(() => inputRef.current?.focus(), 0);
          return;
        }
        setPendingHospitalSymptoms(responseSymptoms);
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: `🩺 ${t("hospitalConsentPrompt")} 🏥` }]);
        return;
      }
      if (response.intent === "card") return onCard();
      if (response.intent === "flow" || response.intent === "translation") {
        const reply = response.reply || currentJourneyPrompt();
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: reply }]);
        return;
      }
      if (response.intent === "companion") {
        if (journeyStep === "companion" && companionDecision === "pending") return completeCompanionDecision("use", false);
        return onCompanion();
      }
      const fallback = response.intent === "education" || localTriage.intent === "education" ? `🩺 ${t("medicalEducationFallback")} 🌿` : `💙 ${t("naruConversationFallback")} 😊`;
      const reply = response.reply || fallback;
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: reply, sources: response.sources }]);
    } finally {
      setBusy(false);
    }
  };

  const openJourneyStep = (step: VisitJourneyStep) => {
    if (step === "symptoms") {
      inputRef.current?.focus();
      return;
    }
    onJourneyStep(step);
  };

  const journeyCompleteActions = <div className="journey-complete-actions">
    <Button variant="secondary" onClick={onRecords}>{t("journeyRecords")}</Button>
    <Button onClick={onRestartJourney}>{t("journeyRestart")}</Button>
  </div>;
  const journeyActionLabel = journeyStep === "hospital"
    ? t("findHospital")
    : journeyStep === "prepare"
      ? t("viewVisitFlow")
      : journeyStep === "navigation"
        ? t("route")
        : journeyStep === "translation"
          ? t("translation")
          : "";
  const journeyActionCard = journeyActionLabel ? <section className="journey-action-card" aria-label={t("nextStep")}>
    <span><small>{t("nextStep")}</small><strong>{currentJourneyPrompt()}</strong></span>
    <Button onClick={() => openCurrentJourneyStep()} disabled={busy}>{journeyActionLabel}<ArrowRight size={17} /></Button>
  </section> : null;

  return <div className="agent-grid">
    <Panel className="chat-panel">
      <div className="agent-online"><NaruPose pose={2} className="chat-naru-pose" /><strong>Naru<small>{t("brandSub")}</small></strong><StatusPill><ShieldCheck size={14} />{t("privateConversation")}</StatusPill><button type="button" className="conversation-clear" onClick={() => void clearConversation()} disabled={historyLoading || clearingHistory} aria-label={conversation.clear} title={conversation.clear}><Trash2 size={17} /></button></div>
      <div className="agent-journey-mobile">
        <VisitJourneyProgress compact current={journeyStep} onStep={openJourneyStep} />
        {journeyStep === "complete" && journeyCompleteActions}
      </div>
      <div className="messages" ref={messagesRef}>
        {messages.map((message) => message.role === "status" ? <InfoBanner key={message.id} tone="mint" title={message.text}>{message.detail || t("nearbyAccepting")}</InfoBanner> : <div key={message.id} className={`message message-${message.role}`}>
          {message.role === "naru" && <div className="message-author"><NaruPose pose={2} className="chat-naru-pose" /><strong>Naru<small>{t("brandSub")}</small></strong></div>}
          {message.id === "welcome" ? <WelcomeMessage text={message.text} /> : <p dir="auto">{message.text}</p>}
          {message.sources?.length ? <div className="message-sources">{message.sources.map((source, index) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><span>[{index + 1}]</span>{source.title}{source.year ? ` · ${source.year}` : ""}</a>)}</div> : null}
        </div>)}
        {medicalCardChat && <section className="medical-card-chat" aria-labelledby="medical-card-chat-title">
          <div className="medical-card-chat-heading">
            <span className="medical-card-chat-icon"><BadgeCheck size={21} /></span>
            <span>
              <small>{medicalCardChat.phase === "collect"
                ? medicalCardFlow.progress.replace("{current}", String(medicalCardChat.stepIndex + 1)).replace("{total}", String(MEDICAL_CARD_CHAT_STEPS.length))
                : medicalCardFlow.reviewTitle}</small>
              <strong id="medical-card-chat-title">{medicalCardFlow.title}</strong>
            </span>
          </div>
          <div className="medical-card-chat-progress" role="progressbar" aria-valuemin={0} aria-valuemax={MEDICAL_CARD_CHAT_STEPS.length} aria-valuenow={medicalCardChat.phase === "collect" ? medicalCardChat.stepIndex + 1 : MEDICAL_CARD_CHAT_STEPS.length}>
            <i style={{ width: `${medicalCardChat.phase === "collect" ? ((medicalCardChat.stepIndex + 1) / MEDICAL_CARD_CHAT_STEPS.length) * 100 : 100}%` }} />
          </div>
          {medicalCardChat.phase === "collect" && currentMedicalCardStep && <>
            <p className="medical-card-chat-question">{medicalCardFlow.ask.replace("{field}", medicalCardFieldLabels[currentMedicalCardStep.key])}</p>
            <span className={`medical-card-chat-requirement ${currentMedicalCardStep.required ? "required" : "optional"}`}>{currentMedicalCardStep.required ? medicalCardFlow.required : medicalCardFlow.optional}</span>
            {medicalCardChoiceOptions.length > 0 && <div className="medical-card-chat-options" role="group" aria-label={medicalCardFieldLabels[currentMedicalCardStep.key]}>
              {medicalCardChoiceOptions.map((option) => <button type="button" key={option.value} onClick={() => answerMedicalCardQuestion(option.value, option.label)}>{option.label}</button>)}
            </div>}
            <div className="medical-card-chat-actions">
              {!currentMedicalCardStep.required && <Button variant="secondary" onClick={() => answerMedicalCardQuestion("skip", medicalCardFlow.skip)}>{medicalCardFlow.skip}</Button>}
              <Button variant="ghost" onClick={() => cancelMedicalCardCreation()}>{medicalCardFlow.cancel}</Button>
            </div>
          </>}
          {(medicalCardChat.phase === "review" || medicalCardChat.phase === "saving") && <>
            <p className="medical-card-chat-review-help">{medicalCardFlow.reviewHelp}</p>
            <div className="medical-card-chat-summary">
              {MEDICAL_CARD_CHAT_STEPS.map((step, index) => <button type="button" key={step.key} disabled={medicalCardChat.phase === "saving"} onClick={() => editMedicalCardField(index)} aria-label={medicalCardFlow.editField.replace("{field}", medicalCardFieldLabels[step.key])}>
                <span>{medicalCardFieldLabels[step.key]}<small>{step.required ? medicalCardFlow.required : medicalCardFlow.optional}</small></span>
                <strong dir="auto">{displayMedicalCardValue(step.key, String(medicalCardChat.draft[step.key] || ""))}</strong>
                <Pencil size={14} />
              </button>)}
            </div>
            <div className="medical-card-chat-review-actions">
              <Button variant="secondary" onClick={() => cancelMedicalCardCreation()} disabled={medicalCardChat.phase === "saving"}>{medicalCardFlow.cancel}</Button>
              <Button onClick={() => void saveMedicalCardFromChat()} disabled={medicalCardChat.phase === "saving"}><BadgeCheck size={17} />{medicalCardChat.phase === "saving" ? medicalCardFlow.saving : medicalCardFlow.save}</Button>
            </div>
          </>}
          <p className="medical-card-chat-privacy"><ShieldCheck size={14} />{medicalCardFlow.privacy}</p>
        </section>}
        {journeyStep === "companion" && companionDecision === "pending" && <section className="companion-decision-card" aria-labelledby="companion-decision-title">
          <div><NaruPose pose={11} className="companion-decision-naru" /><span><small>{companionFlow.journeyLabel}</small><strong id="companion-decision-title">{companionFlow.decisionTitle}</strong></span></div>
          <p>{companionFlow.decisionDesc}</p>
          <div className="companion-decision-actions">
            <Button onClick={() => completeCompanionDecision("use", true)}><UserRound size={17} />{companionFlow.useCompanion}</Button>
            <Button variant="secondary" onClick={() => completeCompanionDecision("skip", true)}>{companionFlow.skipCompanion}</Button>
          </div>
        </section>}
        {journeyStep === "appointment" && selectedHospital && chatAppointmentAvailability && <section className="appointment-chat-card" aria-labelledby="appointment-chat-title">
          <div className="appointment-chat-heading">
            <span className="appointment-chat-icon"><CalendarCheck2 size={20} /></span>
            <span><small>{appointmentFlow.demoLabel}</small><strong id="appointment-chat-title">{appointmentFlow.chatTitle}</strong><em>{selectedHospital.name}</em></span>
          </div>
          <p>{appointmentFlow.chatHelp}</p>
          <div className="appointment-chat-window">
            <span><CalendarCheck2 size={14} />{formatAppointmentDate(appointmentPreference.date)}</span>
            <span><Clock3 size={14} />{appointmentPreference.startTime}–{appointmentPreference.endTime}</span>
          </div>
          {chatAppointmentAvailability.policy === "walk_in" ? <div className="appointment-chat-status walk-in"><CalendarOff size={17} /><span>{appointmentFlow.chatWalkIn}</span></div>
            : chatAppointmentAvailability.matchingSlots.length ? <>
              <strong className="appointment-chat-slot-title">{appointmentFlow.chatChooseSlot}</strong>
              <div className="appointment-chat-slots" role="group" aria-label={appointmentFlow.chatChooseSlot}>
                {chatAppointmentAvailability.matchingSlots.map((slot) => <button type="button" key={slot.id} onClick={() => completeAppointmentBooking(slot, true)}><Clock3 size={14} /><span>{slot.startTime}<small>{slot.endTime}</small></span></button>)}
              </div>
            </> : <div className="appointment-chat-status no-match"><AlertTriangle size={17} /><span>{appointmentFlow.chatNoMatch}</span></div>}
          <div className="appointment-chat-actions">
            {chatAppointmentAvailability.policy !== "required" && <Button variant="secondary" onClick={() => completeAppointmentSkip(true)}>{chatAppointmentAvailability.policy === "walk_in" ? appointmentFlow.continueWalkIn : appointmentFlow.continueWithoutBooking}</Button>}
            <Button variant="ghost" onClick={onOpenAppointments}>{appointmentFlow.chatOpenHospitals}</Button>
          </div>
        </section>}
        {journeyActionCard}
        {busy && <div className="typing"><i /><i /><i /></div>}
      </div>
      {!card && !medicalCardChat && <div className="prompt-suggestions"><span>{t("quickServices")}</span><button onClick={() => send(t("promptUnwell"))}>{t("promptUnwell")}</button><button onClick={() => startMedicalCardCreation()}>{t("promptCard")}</button><button onClick={() => send(t("promptCompanion"))}>{t("promptCompanion")}</button></div>}
      <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}><input ref={inputRef} dir="auto" value={input} onChange={(event) => setInput(event.target.value)} placeholder={medicalCardChat?.phase === "collect" ? medicalCardFlow.answerPlaceholder : t("inputPlaceholder")} disabled={historyLoading || clearingHistory || busy || Boolean(medicalCardChat && medicalCardChat.phase !== "collect")} /><button aria-label={t("sendMessage")} disabled={historyLoading || clearingHistory || busy || Boolean(medicalCardChat && medicalCardChat.phase !== "collect")}><ArrowRight /></button></form>
    </Panel>
    <Panel className="agent-status">
      <h3>{t("currentStatus")}</h3>
      <div className={`card-status ${card ? "ready" : "missing"}`}><Stethoscope size={22} /><div><span>{t("navCard")}</span><strong>{card ? t("cardCreated", { name: card.name }) : t("cardNotCreated")}</strong><small>{card ? `${t("userLanguage")} + 한국어` : t("emergencyOnly")}</small></div></div>
      <h3>{t("visitJourney")}</h3>
      <VisitJourneyProgress current={journeyStep} onStep={openJourneyStep} />
      {journeyStep === "complete" && journeyCompleteActions}
      <h3>{t("otherServices")}</h3>
      <button className="quick-link" onClick={() => card ? onCompanion() : setGate(true)}>{t("companion")}<span>{card ? "→" : t("locked")}</span></button>
      <div className="agent-naru-card"><NaruPose pose={6} className="agent-side-naru" /></div>
    </Panel>
    {gate && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="gate-modal"><NaruPose pose={6} className="gate-naru-pose" /><h2>{t("cardMissingShort")}</h2><p>{t("cardRequired")}</p><div><Button onClick={() => startMedicalCardCreation()}>{medicalCardFlow.startAction}</Button><Button variant="danger" onClick={() => { setGate(false); onEmergency(t("unknown")); }}>{t("urgentCall119")}</Button></div><button className="modal-close" onClick={() => setGate(false)}>×</button><small>{t("cardGateHint")}</small></div></div>}
  </div>;
}

export function HospitalsPage({
  location, hospitals, loading, selected, confirmed, appointmentPreference, appointmentDecision, appointmentBooking,
  appointmentComplete, needsCompanionDecision, canRoute, onSelect, onAppointmentPreference, onBookAppointment,
  onSkipAppointment, onCancelAppointment, onFlow, onCompanion, onRoute, onLocationPick, onRefresh,
}: {
  location: LocationState;
  hospitals: Hospital[];
  loading: boolean;
  selected: Hospital | null;
  confirmed: boolean;
  appointmentPreference: AppointmentPreference;
  appointmentDecision: AppointmentDecision;
  appointmentBooking: HospitalAppointmentBooking | null;
  appointmentComplete: boolean;
  needsCompanionDecision: boolean;
  canRoute: boolean;
  onSelect: (hospital: Hospital) => void;
  onAppointmentPreference: (preference: AppointmentPreference) => void;
  onBookAppointment: (slot: HospitalAppointmentSlot) => void;
  onSkipAppointment: () => void;
  onCancelAppointment: () => void;
  onFlow: () => void;
  onCompanion: () => void;
  onRoute: () => void;
  onLocationPick: (lat: number, lng: number) => Promise<void>;
  onRefresh: () => void;
}) {
  const { locale, t } = useI18n();
  const companionFlow = companionFlowCopy(locale);
  const appointmentCopy = hospitalAppointmentCopy(locale);
  const demoLabels = hospitalDemoLabels(locale);
  const [now, setNow] = useState(() => new Date());
  const [onlyMatching, setOnlyMatching] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [manualPoint, setManualPoint] = useState<[number, number]>(() => [location.lat, location.lng]);
  const hospitalScrollRef = useRef<HTMLDivElement>(null);
  const selectionSourceRef = useRef<"map" | "list" | null>(null);
  const today = useMemo(() => {
    const local = new Date();
    local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
    return local.toISOString().slice(0, 10);
  }, []);
  const availabilityByHospital = useMemo(() => new globalThis.Map<string, HospitalAppointmentAvailability>(hospitals.map((hospital) => [
    hospital.id,
    appointmentAvailabilityFor(hospital, appointmentPreference),
  ])), [appointmentPreference, hospitals]);
  const matchingCount = useMemo(() => hospitals.filter((hospital) => availabilityByHospital.get(hospital.id)?.matchingSlots.length).length, [availabilityByHospital, hospitals]);
  const visibleHospitals = useMemo(() => onlyMatching
    ? hospitals.filter((hospital) => availabilityByHospital.get(hospital.id)?.matchingSlots.length)
    : hospitals, [availabilityByHospital, hospitals, onlyMatching]);
  const selectedAvailability = selected ? availabilityByHospital.get(selected.id) : undefined;
  const selectedSlot = selectedAvailability?.matchingSlots.find((slot) => slot.id === selectedSlotId) || null;
  const activeBooking = appointmentBooking?.hospitalId === selected?.id ? appointmentBooking : null;
  const formatDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString(locale, { month: "short", day: "numeric", weekday: "short" });
  const selectFromMap = useCallback((hospital: Hospital) => {
    selectionSourceRef.current = "map";
    onSelect(hospital);
  }, [onSelect]);
  const selectFromList = useCallback((hospital: Hospital) => {
    selectionSourceRef.current = "list";
    onSelect(hospital);
  }, [onSelect]);
  const updatePreference = (key: keyof AppointmentPreference, value: string) => {
    const next = { ...appointmentPreference, [key]: value };
    const toMinutes = (time: string) => {
      const [hour, minute] = time.split(":").map(Number);
      return hour * 60 + minute;
    };
    const fromMinutes = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    if (next.startTime >= next.endTime && key === "startTime") {
      const end = Math.min(23 * 60 + 59, toMinutes(next.startTime) + 30);
      if (end <= toMinutes(next.startTime)) return;
      next.endTime = fromMinutes(end);
    }
    if (next.startTime >= next.endTime && key === "endTime") {
      next.startTime = fromMinutes(Math.max(0, toMinutes(next.endTime) - 30));
    }
    onAppointmentPreference(next);
  };

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { setManualPoint([location.lat, location.lng]); }, [location.lat, location.lng]);
  useEffect(() => {
    if (!selected || selectionSourceRef.current !== "map") return;
    const selectedItem = hospitalScrollRef.current?.querySelector<HTMLElement>(".hospital-item.selected");
    selectedItem?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    selectionSourceRef.current = null;
  }, [selected?.id]);
  useEffect(() => {
    setSelectedSlotId(selectedAvailability?.matchingSlots[0]?.id || "");
  }, [appointmentPreference.date, appointmentPreference.endTime, appointmentPreference.startTime, selected?.id, selectedAvailability?.matchingSlots]);

  return <Panel className="hospital-panel">
    <InfoBanner title={location.verified ? t("analysisResult") : t("currentLocation")} action={<NaruPose pose={5} className="hospital-banner-naru" />}><strong>{location.verified ? t("hospitalNotice") : t("locationDenied")}</strong></InfoBanner>
    {location.verified && <section className="appointment-preference" aria-labelledby="appointment-preference-title">
      <div className="appointment-preference-copy"><small>{appointmentCopy.demoLabel}</small><h3 id="appointment-preference-title">{appointmentCopy.preferenceTitle}</h3><p>{appointmentCopy.preferenceDesc}</p></div>
      <div className="appointment-time-fields">
        <label><span>{appointmentCopy.date}</span><input type="date" min={today} value={appointmentPreference.date} onChange={(event) => updatePreference("date", event.target.value)} /></label>
        <label><span>{appointmentCopy.startTime}</span><input type="time" max={appointmentPreference.endTime} value={appointmentPreference.startTime} onChange={(event) => updatePreference("startTime", event.target.value)} /></label>
        <label><span>{appointmentCopy.endTime}</span><input type="time" min={appointmentPreference.startTime} value={appointmentPreference.endTime} onChange={(event) => updatePreference("endTime", event.target.value)} /></label>
      </div>
      <label className="appointment-match-toggle"><input type="checkbox" checked={onlyMatching} onChange={(event) => setOnlyMatching(event.target.checked)} /><span><Check size={14} /></span>{appointmentCopy.onlyMatching}</label>
      <strong className="appointment-match-count">{appointmentCopy.matchCount.replace("{count}", String(matchingCount))}</strong>
    </section>}
    <div className="hospital-layout">
      <div className={`map-card ${location.verified ? "" : "manual-location-card"}`}><div className="map-location"><MapPin size={17} />{t("currentLocation")}{location.verified ? ` · ${location.address}` : ""}</div>{location.verified
        ? <InteractiveMap center={[location.lat, location.lng]} hospitals={visibleHospitals} selected={selected} onSelect={selectFromMap} />
        : <div className="hospital-location-picker"><LocationPickerMap center={manualPoint} onPick={(lat, lng) => setManualPoint([lat, lng])} className="hospital-manual-picker" /><div className="hospital-location-picker-actions"><p>{t("mapPickerHelp")}</p><Button onClick={() => void onLocationPick(manualPoint[0], manualPoint[1])} disabled={loading}><MapPin size={16} />{loading ? t("locating") : t("findHospital")}</Button></div></div>}
      </div>
      <div className="hospital-list"><div className="section-heading"><h3>{t("nearbyAccepting")}</h3><button onClick={onRefresh}><LocateFixed size={16} />{t("refreshLocation")}</button></div><div className="hospital-scroll" ref={hospitalScrollRef}>
        {loading ? <div className="empty-hospitals"><LocateFixed /><strong>{t("locating")}</strong><p>{t("loading")}</p></div> : !location.verified ? <div className="empty-hospitals"><MapPin /><strong>{t("locationDenied")}</strong><p>{t("mapPickerHelp")}</p><Button variant="secondary" onClick={onRefresh}><LocateFixed size={16} />{t("useCurrentLocation")}</Button></div> : !hospitals.length ? <div className="empty-hospitals"><AlertTriangle /><strong>{t("noHospitalsFound")}</strong><p>{t("hospitalSearchFailed")}</p></div> : onlyMatching && !visibleHospitals.length ? <div className="empty-hospitals"><CalendarOff /><strong>{appointmentCopy.noMatchedHospitals}</strong></div> : null}
        {visibleHospitals.map((hospital) => {
          const schedule = evaluateOpeningHours(hospital.openingHours, now);
          const isOpen = typeof hospital.openNow === "boolean" ? hospital.openNow : schedule.isOpen;
          const restDays = formatRestDays(schedule.restDayIndexes, locale);
          const openingSchedule = formatOpeningSchedule(hospital.openingHours, locale);
          const reservationKey = hospital.reservation === "required" ? "reservationRequired" : hospital.reservation === "recommended" ? "reservationRecommended" : hospital.reservation === "not_required" ? "reservationNotRequired" : "reservationUnverified";
          const statusKey = isOpen === true ? "openNow" : isOpen === false ? "closedNow" : "openStatusUnverified";
          const officialSummary = [hospital.officialInstitutionType, hospital.officialSpecialties?.join(" · "), hospital.officialSpecialistCount ? t("hiraSpecialists", { count: hospital.officialSpecialistCount }) : ""].filter(Boolean).join(" · ");
          const isSelected = selected?.id === hospital.id;
          const demoInsight = hospitalDemoInsightFor(hospital);
          const appointment = availabilityByHospital.get(hospital.id)!;
          const appointmentLabel = appointment.policy === "walk_in" ? appointmentCopy.walkInBadge : appointment.matchingSlots.length ? appointmentCopy.matchBadge : appointmentCopy.mismatchBadge;
          const policyLabel = appointment.policy === "required" ? appointmentCopy.requiredBadge : appointment.policy === "optional" ? appointmentCopy.optionalBadge : appointmentCopy.walkInBadge;
          return <button className={`hospital-item ${isSelected ? "selected" : ""}`} key={hospital.id} data-hospital-id={hospital.id} aria-pressed={isSelected} onClick={() => selectFromList(hospital)}>
            <span className="hospital-icon">✚</span><strong className="hospital-main">{hospital.name}<small>{hospital.type || (hospital.emergency ? t("emergencyDept") : t("hospital"))}</small><em className={`open-state ${isOpen === true ? "is-open" : isOpen === false ? "is-closed" : "is-unknown"}`}>{t(statusKey)}</em>
              <span className={`appointment-availability ${appointment.matchingSlots.length ? "matches" : appointment.policy === "walk_in" ? "walk-in" : "mismatch"}`}><CalendarCheck2 size={13} /><b>{appointmentLabel}</b><small>{appointmentCopy.demoLabel} · {policyLabel}</small></span>
              <span className="hospital-facts"><span><Clock3 /> <b>{t("openingHoursLabel")}</b>{openingSchedule || t("hoursUnverified")}</span><span><CalendarOff /><b>{t("restDaysLabel")}</b>{restDays === "" ? t("noFixedRestDay") : restDays || t("restDaysUnverified")}</span><span><CalendarCheck2 /><b>{t("reservationLabel")}</b>{t(reservationKey)}{hospital.reservation === "unknown" && hospital.phone ? ` · ${hospital.phone}` : ""}</span>{officialSummary && <span className="hira-fact"><Stethoscope /><b>{t("hiraOfficialLabel")}</b>{officialSummary}</span>}</span>
              <small className="hospital-source" title={hospital.sourceUrl}>{t("hospitalDataSource", { source: hospital.dataSource || "OpenStreetMap" })}{hospital.lastVerified ? ` · ${t("verifiedDate", { date: hospital.lastVerified })}` : ""}</small>
              <span className="hospital-demo">
                <span className="hospital-demo-heading"><i>{demoLabels.demoData}</i><span title={demoLabels.foreignRating}><Star size={12} fill="currentColor" />{demoInsight.foreignPatientRating.toFixed(1)} <small>({demoInsight.reviewCount})</small></span></span>
                <span className="hospital-demo-languages"><Languages size={14} /><b>{demoLabels.languageSupport}</b>{demoInsight.languages.map((code) => <span key={code}>{localeOptions.find((option) => option.code === code)?.nativeName || code}</span>)}</span>
                <span className="hospital-demo-interpreter"><b>{demoLabels.interpreter}</b><span>{hospitalDemoText(demoInsight.interpreterMode, locale)} · {hospitalDemoText(demoInsight.interpreterHours, locale)} · {demoInsight.reservationRequired ? demoLabels.reservationRequired : demoLabels.reservationNotRequired}</span></span>
                {isSelected && <span className="hospital-demo-review"><span><b>{demoLabels.sampleReview}</b><small>★ {demoInsight.review.rating} · {hospitalDemoText(demoInsight.review.department, locale)} · {demoLabels.waitTime.replace("{minutes}", String(demoInsight.review.waitMinutes))} · {demoInsight.review.visitMonth}</small></span><q>{hospitalDemoText(demoInsight.review.text, locale)}</q><small><b>{demoLabels.limitation}</b> · {hospitalDemoText(demoInsight.limitation, locale)}</small></span>}
              </span>
            </strong><b className="hospital-distance">{hospital.distance < 1000 ? `${Math.round(hospital.distance)}m` : `${(hospital.distance / 1000).toFixed(1)}km`}</b>
          </button>;
        })}</div>
      </div>
    </div>
    {confirmed && selected && selectedAvailability && <section className="appointment-booking" aria-labelledby="appointment-booking-title">
      <div className="appointment-booking-heading"><span><small>{appointmentCopy.demoLabel}</small><h3 id="appointment-booking-title">{appointmentCopy.bookingTitle}</h3><p>{selected.name}</p></span><StatusPill tone={selectedAvailability.policy === "required" ? "peach" : "mint"}>{selectedAvailability.policy === "required" ? appointmentCopy.requiredBadge : selectedAvailability.policy === "optional" ? appointmentCopy.optionalBadge : appointmentCopy.walkInBadge}</StatusPill></div>
      {activeBooking ? <div className="appointment-confirmed"><CalendarCheck2 /><span><strong>{appointmentCopy.confirmed}</strong><p>{formatDate(activeBooking.slot.date)} · {activeBooking.slot.startTime}–{activeBooking.slot.endTime}</p><small>{appointmentCopy.bookingNumber.replace("{id}", activeBooking.id)}</small></span><Button variant="ghost" onClick={onCancelAppointment}>{appointmentCopy.cancelBooking}</Button></div>
        : selectedAvailability.policy === "walk_in" ? <div className="appointment-walk-in"><CalendarOff /><p>{appointmentCopy.walkInBadge}</p><Button variant="secondary" onClick={onSkipAppointment}>{appointmentCopy.continueWalkIn}</Button></div>
          : <div className="appointment-slot-picker">
            <div><h4>{appointmentCopy.slotsTitle}</h4><p>{appointmentCopy.slotHelp}</p></div>
            {selectedAvailability.matchingSlots.length ? <div className="appointment-slots" role="group" aria-label={appointmentCopy.slotsTitle}>{selectedAvailability.matchingSlots.map((slot) => <button type="button" key={slot.id} className={selectedSlotId === slot.id ? "selected" : ""} aria-pressed={selectedSlotId === slot.id} onClick={() => setSelectedSlotId(slot.id)}><Clock3 size={14} />{slot.startTime}–{slot.endTime}</button>)}</div> : <div className="appointment-no-match"><AlertTriangle /><strong>{appointmentCopy.noMatchingSlot}</strong>{selectedAvailability.alternatives.length ? <p>{appointmentCopy.alternatives}: {selectedAvailability.alternatives.map((slot) => `${formatDate(slot.date)} ${slot.startTime}`).join(" · ")}</p> : null}</div>}
            {selectedAvailability.policy === "required" && !selectedAvailability.matchingSlots.length && <p className="appointment-required-note">{appointmentCopy.requiredNotice}</p>}
            <div className="appointment-booking-actions">{selectedAvailability.policy === "optional" && <Button variant="secondary" onClick={onSkipAppointment}>{appointmentCopy.continueWithoutBooking}</Button>}<Button onClick={() => selectedSlot && onBookAppointment(selectedSlot)} disabled={!selectedSlot}>{appointmentCopy.book}</Button></div>
          </div>}
      {appointmentDecision === "skip" && <p className="appointment-skipped"><Check size={14} />{selectedAvailability.policy === "walk_in" ? appointmentCopy.continueWalkIn : appointmentCopy.continueWithoutBooking}</p>}
    </section>}
    <div className="hospital-actions"><Button onClick={onFlow} disabled={!selected || !confirmed || !appointmentComplete}>{!confirmed ? t("selectHospitalFirst") : !appointmentComplete ? appointmentCopy.completeFirst : needsCompanionDecision ? companionFlow.decideCompanion : t("prepareSelectedHospital")}</Button><Button variant="secondary" onClick={onCompanion}>{t("companion")}</Button><Button variant="mint" onClick={onRoute} disabled={!selected || !canRoute}><Navigation size={18} />{t("route")}</Button>{selected?.sourceUrl && <a className="button button-ghost" href={selected.sourceUrl} target="_blank" rel="noreferrer">{t("hospitalDataSource", { source: selected.dataSource || "OpenStreetMap" })}</a>}</div>
  </Panel>;
}

export function VisitFlowPage({ onStart, onReturn }: { onStart: () => void; onReturn: () => void }) {
  const { t } = useI18n();
  const prep = [[t("idPassport"), t("idPassportDesc")], [t("insuranceInfo"), t("insuranceInfoDesc")], [t("medicationItem"), t("medicationDesc")], [t("previousResults"), t("previousResultsDesc")]];
  const steps = [[t("stepRegister"), t("stepRegisterDesc")], [t("stepForm"), t("stepFormDesc")], [t("stepWait"), t("stepWaitDesc")], [t("stepRoom"), t("stepRoomDesc")], [t("stepPay"), t("stepPayDesc")]];
  const [checked, setChecked] = useState(() => prep.map(() => false));
  const prepared = checked.every(Boolean);
  return <Panel className="flow-panel">
    <InfoBanner title={t("visitPrepare")} action={<div className="banner-character"><span className="soft-chip">{t("confirmBefore")}</span><NaruPose pose={10} className="flow-banner-naru" /></div>}>{t("prepareSubtitle")}</InfoBanner>
    <div className="prepare-grid">{prep.map(([title, desc], index) => <label className={checked[index] ? "checked" : ""} key={title}><input type="checkbox" checked={checked[index]} onChange={(event) => setChecked((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.checked : value))} /><span><Check size={16} /></span><strong>{title}<small>{desc}</small></strong></label>)}</div>
    <p className="flow-preparation-hint">{t("confirmPreparationItems")}</p>
    <h2>{t("afterArrival")}</h2>
    <div className="flow-steps">{steps.map(([title, desc], index) => <div key={title}><span>{String(index + 1).padStart(2, "0")}</span><strong>{title}<small>{desc}</small></strong>{index < steps.length - 1 && <ArrowRight />}</div>)}</div>
    <InfoBanner title={t("flowReminder")} tone="mint" />
    <div className="flow-choice-actions"><Button variant="secondary" onClick={onReturn}>{t("returnHospitals")}</Button><Button onClick={onStart} disabled={!prepared}><Navigation size={18} />{t("startNavigation")}</Button></div>
  </Panel>;
}

type TravelMode = "walking" | "transit" | "driving";

export function NavigationPage({ location, hospital, onArrived, onTranslation }: { location: LocationState; hospital: Hospital; onArrived: () => void; onTranslation: () => void }) {
  const { locale, t } = useI18n();
  const [mode, setMode] = useState<TravelMode>("walking");
  const [route, setRoute] = useState<[number, number][]>([]);
  const [routeAvailable, setRouteAvailable] = useState(false);
  const [distance, setDistance] = useState(hospital.distance);
  const [duration, setDuration] = useState(Math.max(4, Math.round(hospital.distance / 75)));
  const [addressCopied, setAddressCopied] = useState(false);
  const origin = useMemo<[number, number]>(() => [location.lat, location.lng], [location.lat, location.lng]);
  const destination = useMemo<[number, number]>(() => [hospital.lat, hospital.lng], [hospital.lat, hospital.lng]);
  const destinationAddress = hospital.address?.trim() || `${hospital.lat.toFixed(6)}, ${hospital.lng.toFixed(6)}`;

  useEffect(() => {
    if (!addressCopied) return;
    const timer = window.setTimeout(() => setAddressCopied(false), 2_400);
    return () => window.clearTimeout(timer);
  }, [addressCopied]);

  useEffect(() => {
    if (mode === "transit") { setRoute([]); setRouteAvailable(false); return; }
    let active = true;
    setRouteAvailable(false);
    void api.route(origin, destination, mode).then((result) => {
      if (!active) return;
      setRoute(result.coordinates);
      setRouteAvailable(result.available);
      if (result.distance) setDistance(result.distance);
      if (result.duration) setDuration(Math.max(1, Math.round(result.duration / 60)));
    });
    return () => { active = false; };
  }, [origin[0], origin[1], destination[0], destination[1], mode]);

  const googleUrl = (travelMode: TravelMode) => {
    const params = new URLSearchParams({ api: "1", origin: `${location.lat},${location.lng}`, destination: `${hospital.lat},${hospital.lng}`, travelmode: travelMode, dir_action: "navigate" });
    return `https://www.google.com/maps/dir/?${params}`;
  };
  const kakaoUrl = `https://map.kakao.com/link/to/${encodeURIComponent(hospital.name)},${hospital.lat},${hospital.lng}`;
  const kakaoTaxiUrl = "https://service.kakaomobility.com/launch/kakaot/?ref=KM_homepage_a";
  const uberAppParams = new URLSearchParams({
    "pickup[latitude]": String(location.lat),
    "pickup[longitude]": String(location.lng),
    "pickup[nickname]": "Current location",
    "pickup[formatted_address]": location.address || "Current location",
    "dropoff[latitude]": String(hospital.lat),
    "dropoff[longitude]": String(hospital.lng),
    "dropoff[nickname]": hospital.name,
    "dropoff[formatted_address]": hospital.address || hospital.name,
  });
  const uberWebParams = new URLSearchParams({
    pickup: JSON.stringify({ latitude: location.lat, longitude: location.lng, addressLine1: "Current location", addressLine2: location.address || "Current location" }),
    "drop[0]": JSON.stringify({ latitude: hospital.lat, longitude: hospital.lng, addressLine1: hospital.name, addressLine2: hospital.address || hospital.name }),
  });
  const uberWebUrl = `https://m.uber.com/?${uberWebParams}`;
  const openUber = () => {
    const userAgent = navigator.userAgent;
    if (/Android/i.test(userAgent)) {
      window.location.href = `intent://riderequest?${uberAppParams}#Intent;scheme=uber;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.ubercab;S.browser_fallback_url=${encodeURIComponent(uberWebUrl)};end`;
      return;
    }
    if (/iPhone|iPad|iPod/i.test(userAgent)) {
      const openedAt = Date.now();
      window.location.href = `uber://riderequest?${uberAppParams}`;
      window.setTimeout(() => {
        if (document.visibilityState === "visible" && Date.now() - openedAt < 3_000) window.location.href = uberWebUrl;
      }, 1_500);
      return;
    }
    window.open(uberWebUrl, "_blank", "noopener,noreferrer");
  };
  const openNaverMaps = () => {
    const actionPath = mode === "walking" ? "route/walk" : mode === "transit" ? "route/public" : "navigation";
    const params = new URLSearchParams({
      slat: String(location.lat),
      slng: String(location.lng),
      sname: location.address || "Current location",
      dlat: String(hospital.lat),
      dlng: String(hospital.lng),
      dname: hospital.name,
      appname: `${window.location.origin}${window.location.pathname}`,
    });
    const schemeUrl = `nmap://${actionPath}?${params}`;
    const userAgent = navigator.userAgent;
    if (/Android/i.test(userAgent)) {
      window.location.href = `intent://${actionPath}?${params}#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;end`;
      return;
    }
    if (/iPhone|iPad|iPod/i.test(userAgent)) {
      const openedAt = Date.now();
      window.location.href = schemeUrl;
      window.setTimeout(() => {
        if (document.visibilityState === "visible" && Date.now() - openedAt < 3_000) window.location.href = "https://apps.apple.com/app/id311867728";
      }, 1_500);
      return;
    }
    window.open(`https://map.naver.com/p/search/${encodeURIComponent(hospital.name)}`, "_blank", "noopener,noreferrer");
  };
  const copyDestinationAddress = async () => {
    try {
      await navigator.clipboard.writeText(destinationAddress);
    } catch {
      const field = document.createElement("textarea");
      field.value = destinationAddress;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    setAddressCopied(true);
  };
  const modeLabels: Record<TravelMode, string> = { walking: t("walkingMode"), transit: t("transitMode"), driving: t("drivingMode") };
  const canPreview = mode !== "transit" && routeAvailable;

  return <Panel className="navigation-panel">
    <div className="travel-tabs">{(["walking", "transit", "driving"] as const).map((item) => <button className={mode === item ? "active" : ""} key={item} onClick={() => setMode(item)}>{item === "walking" ? "🚶" : item === "transit" ? "🚇" : "🚗"}<span>{modeLabels[item]}</span></button>)}</div>
    <div className="navigation-layout">
      <div className="map-card"><div className="map-location"><MapPin size={17} />{t("currentLocation")} · {location.address}</div><NaverNavigationMap center={origin} hospital={hospital} route={route} /></div>
      <div className="route-info"><NaruPose pose={14} className="route-naru-pose" /><span>{t("destination")}</span><h2>{hospital.name}</h2><div className="destination-address"><MapPin size={18} /><div><span>{t("hospitalAddress")}</span><strong dir="auto">{destinationAddress}</strong></div><Button type="button" variant="ghost" className={addressCopied ? "copied" : ""} onClick={() => void copyDestinationAddress()} aria-live="polite">{addressCopied ? <Check size={16} /> : <Copy size={16} />}{addressCopied ? t("addressCopied") : t("copyAddress")}</Button></div><strong>{canPreview ? t("routeSummary", { mode: modeLabels[mode], minutes: duration, distance: distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}km` }) : t("routePreviewUnavailable")}</strong><hr /><p>{t("estimatedArrival")}<b>{canPreview ? new Date(Date.now() + duration * 60000).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "—"}</b></p><p>{t("routeStatus")}<b>{canPreview ? t("inProgress") : t("externalNavigation")}</b></p>
        <InfoBanner tone="mint" title={t("autoTranslation")}>{t("arrivalTip")}</InfoBanner>
        <div className="taxi-address-tip"><CarFront size={20} /><span><strong>{t("taxiAddressTitle")}</strong><small>{t("taxiAddressTip")}</small></span></div>
        <div className="external-app-group"><h3><Map size={17} />{t("mapNavigationApps")}</h3><div className="external-map-links map-app-links"><Button className="app-link app-link-naver" onClick={openNaverMaps}><Map size={18} />Naver Maps</Button><a className="button app-link app-link-google" href={googleUrl(mode)} target="_blank" rel="noreferrer"><Map size={18} />Google Maps</a><a className="button app-link app-link-kakao-map" href={kakaoUrl} target="_blank" rel="noreferrer"><Map size={18} />Kakao Maps</a></div></div>
        <div className="external-app-group"><h3><CarFront size={17} />{t("taxiApps")}</h3><div className="external-map-links taxi-app-links"><a className="button app-link app-link-kakao-t" href={kakaoTaxiUrl} target="_blank" rel="noreferrer" title={t("taxiAddressTip")}><CarFront size={18} />Kakao T</a><Button className="app-link app-link-uber" type="button" onClick={openUber} title={t("taxiAddressTip")}><CarFront size={18} />Uber</Button></div></div>
        <Button onClick={onArrived}><MapPin size={18} />{t("arrived")}</Button><Button variant="secondary" onClick={onTranslation}>{t("openTranslation")}</Button>
      </div>
    </div>
  </Panel>;
}

interface SpeechRecognitionResultEventLike extends Event { results: { [index: number]: { [index: number]: { transcript: string } } }; }
interface SpeechRecognitionErrorEventLike extends Event { error?: string; }
interface SpeechRecognitionLike { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; abort(): void; onresult: ((event: SpeechRecognitionResultEventLike) => void) | null; onend: (() => void) | null; onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null; }
interface TranslationTurn extends TranslationRecordEntry { id: string }

export function TranslationPage({ userLanguage, active = true, onRecorded, onComplete }: { userLanguage?: string; active?: boolean; onRecorded?: (entry: TranslationRecordEntry) => void; onComplete?: () => void }) {
  const { locale, t } = useI18n();
  const [language, setLanguage] = useState(userLanguage || locale);
  const languageOption = localeOptions.find((item) => item.code === language) || localeOptions.find((item) => item.code === locale) || localeOptions[0];
  const [speaker, setSpeaker] = useState<"patient" | "staff">("patient");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<TranslationTurn[]>(() => [
    {
      id: "sample-patient",
      speaker: "patient",
      sourceText: t("samplePatient"),
      translatedText: t("samplePatientKo"),
      sourceLanguage: userLanguage || locale,
      targetLanguage: "ko",
      timestamp: new Date(Date.now() - 60_000).toISOString(),
    },
    {
      id: "sample-staff",
      speaker: "staff",
      sourceText: t("sampleStaffKo"),
      translatedText: t("sampleStaffUser"),
      sourceLanguage: "ko",
      targetLanguage: userLanguage || locale,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [transcribingVoice, setTranscribingVoice] = useState(false);
  const [busy, setBusy] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const conversationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userLanguage) setLanguage(userLanguage);
  }, [userLanguage]);
  useEffect(() => {
    const container = conversationRef.current;
    if (container) container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [turns]);

  async function translate(event?: FormEvent) {
    event?.preventDefault();
    if (!input.trim()) return;
    setBusy(true);
    try {
      const sourceText = input.trim();
      let entry: TranslationTurn;
      if (speaker === "patient") {
        const translatedText = await api.translate(sourceText, language, "ko");
        entry = { id: crypto.randomUUID(), speaker, sourceText, translatedText, sourceLanguage: language, targetLanguage: "ko", timestamp: new Date().toISOString() };
      } else {
        const translatedText = await api.translate(sourceText, "ko", language);
        entry = { id: crypto.randomUUID(), speaker, sourceText, translatedText, sourceLanguage: "ko", targetLanguage: language, timestamp: new Date().toISOString() };
      }
      setTurns((current) => [...current, entry]);
      onRecorded?.(entry);
      setInput("");
    } catch { setVoiceError(t("errorGeneric")); }
    finally { setBusy(false); }
  }

  function speak(text: string, lang: string) {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = lang; speechSynthesis.speak(utterance);
  }

  function selectSpeaker(next: "patient" | "staff") {
    setSpeaker(next);
    setInput("");
    setVoiceError("");
    recognitionRef.current?.abort();
  }

  async function startRecorderFallback() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceError(t("voiceUnavailable"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => { setVoiceError(t("microphoneDenied")); setListening(false); };
      recorder.onstop = () => {
        const audio = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        voiceStreamRef.current = null;
        recorderRef.current = null;
        setListening(false);
        if (!audio.size) return;
        setTranscribingVoice(true);
        void api.transcribe(audio, language.split("-")[0])
          .then((text) => { if (text) setInput(text); else setVoiceError(t("voiceUnavailable")); })
          .catch(() => setVoiceError(t("voiceUnavailable")))
          .finally(() => setTranscribingVoice(false));
      };
      setListening(true);
      recorder.start();
    } catch { setVoiceError(t("microphoneDenied")); setListening(false); }
  }

  function toggleListening() {
    setVoiceError("");
    if (listening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      return;
    }
    const scope = window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike; SpeechRecognition?: new () => SpeechRecognitionLike };
    const Recognition = scope.SpeechRecognition || scope.webkitSpeechRecognition;
    if (!Recognition) { void startRecorderFallback(); return; }
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = speaker === "patient" ? languageOption.speech : "ko-KR"; recognition.continuous = false; recognition.interimResults = false;
    recognition.onresult = (event) => setInput(event.results[0][0].transcript);
    recognition.onend = () => { recognitionRef.current = null; setListening(false); };
    recognition.onerror = (event) => {
      recognitionRef.current = null;
      setListening(false);
      setVoiceError(event.error === "not-allowed" || event.error === "service-not-allowed" ? t("microphoneDenied") : t("voiceUnavailable"));
    };
    try { setListening(true); recognition.start(); }
    catch { recognitionRef.current = null; setListening(false); void startRecorderFallback(); }
  }

  useEffect(() => () => {
    recognitionRef.current?.abort();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (active) return;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    setListening(false);
    speechSynthesis.cancel();
  }, [active]);

  return <Panel className="translation-panel">
    <label className="translation-language-picker">
      <NaruPose pose={15} className="translation-header-naru" />
      <Languages size={17} />
      <select aria-label={t("chooseLanguage")} value={language} onChange={(event) => {
        setLanguage(event.target.value);
        setInput("");
        setTurns([]);
        setVoiceError("");
      }}>
        {localeOptions.map((option) => <option key={option.code} value={option.code}>{option.badge} {option.nativeName}</option>)}
      </select>
    </label>
    <div className="translation-direction"><button type="button" className={speaker === "patient" ? "active peach" : ""} onClick={() => selectSpeaker("patient")}>{t("patientLanguage", { language: languageOption.nativeName })}</button><ArrowRight /><button type="button" className={speaker === "staff" ? "active mint" : ""} onClick={() => selectSpeaker("staff")}>{t("hospitalLanguage")}</button></div>
    <div className="translation-conversation" ref={conversationRef} aria-live="polite">
      {turns.length ? turns.map((turn) => {
        const patient = turn.speaker === "patient";
        const targetSpeech = turn.targetLanguage === "ko" ? "ko-KR" : localeOptions.find((option) => option.code === turn.targetLanguage)?.speech || languageOption.speech;
        return <article className={`translation-turn ${patient ? "patient" : "staff"}`} key={turn.id}>
          <header><span>{patient ? t("patientLanguage", { language: languageOption.nativeName }) : t("hospitalLanguage")}</span><time>{new Date(turn.timestamp).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</time></header>
          <p className="translation-source" dir="auto" lang={turn.sourceLanguage}>{turn.sourceText}</p>
          <div className="translation-result"><Languages size={16} /><span><small>{patient ? t("naruTranslatedKorean") : t("naruTranslatedUser")}</small><p dir="auto" lang={turn.targetLanguage}>{turn.translatedText}</p></span><button type="button" onClick={() => speak(turn.translatedText, targetSpeech)} aria-label={t("tapToSpeak")} title={t("tapToSpeak")}><Volume2 size={16} /></button></div>
        </article>;
      }) : <div className="translation-empty"><NaruPose pose={16} className="translation-empty-naru" /><Languages size={22} /><p>{t("translationInput")}</p></div>}
    </div>
    <form className="translation-composer" onSubmit={translate}><textarea dir={speaker === "staff" ? "ltr" : "auto"} lang={speaker === "staff" ? "ko" : language} value={input} onChange={(event) => setInput(event.target.value)} placeholder={t("translationInput")} /><button type="button" className={`mic-button ${listening ? "listening" : ""}`} onClick={toggleListening} disabled={transcribingVoice}>{listening ? <Square /> : <Mic />}</button><span>{transcribingVoice ? t("transcribingVoice") : listening ? t("listening") : t("tapToSpeak")}</span><Button type="submit" disabled={busy || transcribingVoice || !input.trim()}><Send size={17} />{busy ? t("loading") : t("translateSend")}</Button>{voiceError && <p className="form-error" role="alert">{voiceError}</p>}</form>
    {onComplete && <div className="translation-finish"><Button variant="secondary" onClick={onComplete}>{t("finishVisitAssistance")}</Button></div>}
  </Panel>;
}
