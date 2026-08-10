import {
  isJourneyChatActionAllowed,
  journeyChatActionRequiresHighConfidence,
  visitJourneySteps,
  type CompanionDecision,
  type JourneyModelAction,
  type VisitJourneyStep,
} from "./visitJourney";

export const agentToolNames = [
  "none",
  "collect_symptoms",
  "search_hospitals",
  "open_appointment_slots",
  "skip_appointment",
  "set_companion_preference",
  "open_preparation",
  "open_navigation",
  "start_translation",
  "change_hospital",
  "confirm_arrival",
  "complete_visit",
  "explain_current_step",
] as const;

export type AgentToolName = typeof agentToolNames[number];
export type AgentRuntimeMode = "deterministic" | "openai_function_call" | "structured_fallback";
export type AgentToolStatus = "none" | "ready" | "blocked";
export type AgentToolReason =
  | "no_action"
  | "ready"
  | "invalid_tool_arguments"
  | "wrong_step"
  | "low_confidence"
  | "missing_symptoms"
  | "hospital_not_selected"
  | "appointment_incomplete"
  | "appointment_required"
  | "companion_undecided"
  | "preparation_incomplete"
  | "arrival_not_confirmed"
  | "translation_not_active";

export interface AgentJourneyObservation {
  journeyStep: VisitJourneyStep;
  hasCard: boolean;
  symptoms: string;
  hospitalResultCount: number;
  selectedHospital: string;
  hospitalConfirmed: boolean;
  appointmentDecision: "pending" | "booked" | "skip";
  appointmentCanSkip: boolean;
  appointmentSlotCount: number;
  companionDecision: CompanionDecision;
  preparationComplete: boolean;
  arrived: boolean;
  translationActive: boolean;
}

export interface AgentToolDecision {
  requestedAction: JourneyModelAction;
  acceptedAction: JourneyModelAction;
  tool: AgentToolName;
  status: AgentToolStatus;
  reason: AgentToolReason;
  missingRequirements: string[];
  requiresConfirmation: boolean;
  runtime?: AgentRuntimeMode;
  iterations?: number;
  trace?: AgentToolTrace[];
}

export interface AgentToolTrace {
  iteration: number;
  tool: AgentToolName;
  requestedAction: JourneyModelAction;
  acceptedAction: JourneyModelAction;
  status: AgentToolStatus;
  reason: AgentToolReason;
  missingRequirements: string[];
  requiresConfirmation: boolean;
}

const defaultObservation: AgentJourneyObservation = {
  journeyStep: "symptoms",
  hasCard: false,
  symptoms: "",
  hospitalResultCount: 0,
  selectedHospital: "",
  hospitalConfirmed: false,
  appointmentDecision: "pending",
  appointmentCanSkip: false,
  appointmentSlotCount: 0,
  companionDecision: "pending",
  preparationComplete: false,
  arrived: false,
  translationActive: false,
};

function safeCount(value: unknown) {
  const count = typeof value === "number" ? value : Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.min(100, Math.floor(count))) : 0;
}

export function normalizeAgentJourneyObservation(value: unknown): AgentJourneyObservation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...defaultObservation };
  const record = value as Record<string, unknown>;
  const journeyStep = typeof record.journeyStep === "string" && visitJourneySteps.includes(record.journeyStep as VisitJourneyStep)
    ? record.journeyStep as VisitJourneyStep
    : defaultObservation.journeyStep;
  const appointmentDecision = record.appointmentDecision === "booked" || record.appointmentDecision === "skip"
    ? record.appointmentDecision
    : "pending";
  const companionDecision = record.companionDecision === "use" || record.companionDecision === "skip"
    ? record.companionDecision
    : "pending";
  return {
    journeyStep,
    hasCard: record.hasCard === true,
    symptoms: typeof record.symptoms === "string" ? record.symptoms.trim().slice(0, 1_000) : "",
    hospitalResultCount: safeCount(record.hospitalResultCount),
    selectedHospital: typeof record.selectedHospital === "string" ? record.selectedHospital.trim().slice(0, 120) : "",
    hospitalConfirmed: record.hospitalConfirmed === true,
    appointmentDecision,
    appointmentCanSkip: record.appointmentCanSkip === true,
    appointmentSlotCount: safeCount(record.appointmentSlotCount),
    companionDecision,
    preparationComplete: record.preparationComplete === true,
    arrived: record.arrived === true,
    translationActive: record.translationActive === true,
  };
}

export function agentToolForAction(step: VisitJourneyStep, action: JourneyModelAction): AgentToolName {
  if (action === "none") return "none";
  if (action === "explain_current_step") return "explain_current_step";
  if (action === "change_hospital") return "change_hospital";
  if (action === "skip_appointment") return "skip_appointment";
  if (action === "use_companion" || action === "skip_companion") return "set_companion_preference";
  if (action === "confirm_arrival") return "confirm_arrival";
  if (action === "complete_visit") return "complete_visit";
  if (step === "symptoms") return "collect_symptoms";
  if (step === "hospital") return "search_hospitals";
  if (step === "appointment") return "open_appointment_slots";
  if (step === "companion") return "set_companion_preference";
  if (step === "prepare") return "open_preparation";
  if (step === "navigation") return "open_navigation";
  if (step === "translation") return "start_translation";
  return "none";
}

export function journeyActionForAgentTool(tool: AgentToolName, companionChoice?: "use" | "skip"): JourneyModelAction | null {
  if (tool === "none" || tool === "collect_symptoms") return "none";
  if (tool === "search_hospitals" || tool === "open_appointment_slots" || tool === "open_preparation"
    || tool === "open_navigation" || tool === "start_translation") return "open_current_step";
  if (tool === "set_companion_preference") {
    if (companionChoice === "use") return "use_companion";
    if (companionChoice === "skip") return "skip_companion";
    return null;
  }
  if (tool === "skip_appointment" || tool === "change_hospital" || tool === "confirm_arrival"
    || tool === "complete_visit" || tool === "explain_current_step") return tool;
  return null;
}

function blockedDecision(
  observation: AgentJourneyObservation,
  action: JourneyModelAction,
  reason: Exclude<AgentToolReason, "no_action" | "ready">,
  missingRequirements: string[],
): AgentToolDecision {
  return {
    requestedAction: action,
    acceptedAction: "explain_current_step",
    tool: agentToolForAction(observation.journeyStep, action),
    status: "blocked",
    reason,
    missingRequirements,
    requiresConfirmation: false,
  };
}

export function verifyAgentToolCall(
  observationValue: AgentJourneyObservation,
  action: JourneyModelAction,
  confidence: "high" | "medium" | "low",
): AgentToolDecision {
  const observation = normalizeAgentJourneyObservation(observationValue);
  if (action === "none") {
    return {
      requestedAction: action,
      acceptedAction: action,
      tool: "none",
      status: "none",
      reason: "no_action",
      missingRequirements: [],
      requiresConfirmation: false,
    };
  }
  if (!isJourneyChatActionAllowed(observation.journeyStep, action)) {
    return blockedDecision(observation, action, "wrong_step", [observation.journeyStep]);
  }
  if (journeyChatActionRequiresHighConfidence(action) && confidence !== "high") {
    return blockedDecision(observation, action, "low_confidence", ["explicit_user_confirmation"]);
  }

  if ((action === "open_current_step" && observation.journeyStep === "hospital") || action === "change_hospital") {
    if (!observation.symptoms) return blockedDecision(observation, action, "missing_symptoms", ["symptoms"]);
  }
  if (action === "open_current_step" && observation.journeyStep === "appointment") {
    if (!observation.selectedHospital || !observation.hospitalConfirmed) {
      return blockedDecision(observation, action, "hospital_not_selected", ["selected_hospital"]);
    }
  }
  if (action === "open_current_step" && observation.journeyStep === "companion") {
    if (observation.appointmentDecision === "pending") {
      return blockedDecision(observation, action, "appointment_incomplete", ["appointment_decision"]);
    }
  }
  if (action === "open_current_step" && observation.journeyStep === "prepare" && observation.companionDecision === "pending") {
    return blockedDecision(observation, action, "companion_undecided", ["companion_decision"]);
  }
  if (action === "open_current_step" && observation.journeyStep === "navigation" && !observation.preparationComplete) {
    return blockedDecision(observation, action, "preparation_incomplete", ["visit_preparation"]);
  }
  if (action === "open_current_step" && observation.journeyStep === "translation" && !observation.arrived) {
    return blockedDecision(observation, action, "arrival_not_confirmed", ["arrival_confirmation"]);
  }
  if (action === "skip_appointment") {
    if (!observation.selectedHospital || !observation.hospitalConfirmed) {
      return blockedDecision(observation, action, "hospital_not_selected", ["selected_hospital"]);
    }
    if (!observation.appointmentCanSkip) {
      return blockedDecision(observation, action, "appointment_required", ["appointment_booking"]);
    }
  }
  if ((action === "use_companion" || action === "skip_companion") && observation.appointmentDecision === "pending") {
    return blockedDecision(observation, action, "appointment_incomplete", ["appointment_decision"]);
  }
  if (action === "confirm_arrival" && (!observation.selectedHospital || !observation.hospitalConfirmed)) {
    return blockedDecision(observation, action, "hospital_not_selected", ["selected_hospital"]);
  }
  if (action === "complete_visit" && !observation.translationActive) {
    return blockedDecision(observation, action, "translation_not_active", ["translation_session"]);
  }

  return {
    requestedAction: action,
    acceptedAction: action,
    tool: agentToolForAction(observation.journeyStep, action),
    status: "ready",
    reason: "ready",
    missingRequirements: [],
    requiresConfirmation: journeyChatActionRequiresHighConfidence(action),
  };
}

export function finalizeAgentToolDecision(
  observationValue: AgentJourneyObservation,
  proposedAction: JourneyModelAction,
  confidence: "high" | "medium" | "low",
  runtime: AgentRuntimeMode,
  trace: AgentToolTrace[] = [],
): AgentToolDecision {
  const observation = normalizeAgentJourneyObservation(observationValue);
  const iterations = trace.reduce((highest, entry) => Math.max(highest, entry.iteration), 0);
  const metadata = { runtime, iterations, trace };

  if (runtime !== "openai_function_call") {
    return { ...verifyAgentToolCall(observation, proposedAction, confidence), ...metadata };
  }

  const lastCall = trace.at(-1);
  if (!lastCall) {
    if (proposedAction === "none") {
      return { ...verifyAgentToolCall(observation, "none", confidence), ...metadata };
    }
    return {
      requestedAction: proposedAction,
      acceptedAction: "explain_current_step",
      tool: agentToolForAction(observation.journeyStep, proposedAction),
      status: "blocked",
      reason: "invalid_tool_arguments",
      missingRequirements: ["matching_function_call"],
      requiresConfirmation: false,
      ...metadata,
    };
  }

  if (lastCall.status === "blocked") {
    return {
      requestedAction: lastCall.requestedAction,
      acceptedAction: "explain_current_step",
      tool: lastCall.tool,
      status: "blocked",
      reason: lastCall.reason,
      missingRequirements: lastCall.missingRequirements,
      requiresConfirmation: lastCall.requiresConfirmation,
      ...metadata,
    };
  }

  return {
    ...verifyAgentToolCall(observation, lastCall.acceptedAction, "high"),
    ...metadata,
  };
}
