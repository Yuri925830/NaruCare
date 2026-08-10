import { describe, expect, it } from "vitest";
import {
  agentToolForAction,
  finalizeAgentToolDecision,
  journeyActionForAgentTool,
  normalizeAgentJourneyObservation,
  verifyAgentToolCall,
  type AgentJourneyObservation,
} from "./agentWorkflow";

function observation(patch: Partial<AgentJourneyObservation> = {}): AgentJourneyObservation {
  return {
    journeyStep: "symptoms",
    hasCard: true,
    symptoms: "headache since this morning",
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
    ...patch,
  };
}

describe("agent workflow tools", () => {
  it("maps the same UI action to the tool for the current observation", () => {
    expect(agentToolForAction("hospital", "open_current_step")).toBe("search_hospitals");
    expect(agentToolForAction("appointment", "open_current_step")).toBe("open_appointment_slots");
    expect(agentToolForAction("translation", "complete_visit")).toBe("complete_visit");
  });

  it("maps native function calls back to frontend actions", () => {
    expect(journeyActionForAgentTool("search_hospitals")).toBe("open_current_step");
    expect(journeyActionForAgentTool("set_companion_preference", "use")).toBe("use_companion");
    expect(journeyActionForAgentTool("set_companion_preference")).toBeNull();
    expect(journeyActionForAgentTool("confirm_arrival")).toBe("confirm_arrival");
  });

  it("normalizes untrusted client observations", () => {
    expect(normalizeAgentJourneyObservation({
      journeyStep: "invalid",
      hospitalResultCount: -10,
      appointmentDecision: "invented",
      companionDecision: "use",
    })).toMatchObject({
      journeyStep: "symptoms",
      hospitalResultCount: 0,
      appointmentDecision: "pending",
      companionDecision: "use",
    });
  });

  it("blocks hospital search until symptoms are available", () => {
    const result = verifyAgentToolCall(observation({ journeyStep: "hospital", symptoms: "" }), "open_current_step", "high");
    expect(result).toMatchObject({
      requestedAction: "open_current_step",
      acceptedAction: "explain_current_step",
      status: "blocked",
      reason: "missing_symptoms",
    });
  });

  it("opens appointment tools only after a confirmed hospital selection", () => {
    const blocked = verifyAgentToolCall(observation({ journeyStep: "appointment" }), "open_current_step", "high");
    expect(blocked.reason).toBe("hospital_not_selected");

    const ready = verifyAgentToolCall(observation({
      journeyStep: "appointment",
      selectedHospital: "Seoul Clinic",
      hospitalConfirmed: true,
    }), "open_current_step", "high");
    expect(ready).toMatchObject({ status: "ready", tool: "open_appointment_slots" });
  });

  it("does not skip a required appointment", () => {
    const result = verifyAgentToolCall(observation({
      journeyStep: "appointment",
      selectedHospital: "Seoul Clinic",
      hospitalConfirmed: true,
      appointmentCanSkip: false,
    }), "skip_appointment", "high");
    expect(result).toMatchObject({ status: "blocked", reason: "appointment_required" });
  });

  it("requires completed appointment context before a companion choice", () => {
    const blocked = verifyAgentToolCall(observation({ journeyStep: "companion" }), "skip_companion", "high");
    expect(blocked.reason).toBe("appointment_incomplete");

    const ready = verifyAgentToolCall(observation({
      journeyStep: "companion",
      appointmentDecision: "booked",
    }), "skip_companion", "high");
    expect(ready).toMatchObject({ status: "ready", tool: "set_companion_preference" });
  });

  it("requires explicit high-confidence confirmation for state changes", () => {
    const result = verifyAgentToolCall(observation({
      journeyStep: "navigation",
      selectedHospital: "Seoul Clinic",
      hospitalConfirmed: true,
      preparationComplete: true,
    }), "confirm_arrival", "medium");
    expect(result).toMatchObject({ status: "blocked", reason: "low_confidence" });
  });

  it("completes a visit only while translation is active", () => {
    const blocked = verifyAgentToolCall(observation({ journeyStep: "translation" }), "complete_visit", "high");
    expect(blocked.reason).toBe("translation_not_active");

    const ready = verifyAgentToolCall(observation({ journeyStep: "translation", arrived: true, translationActive: true }), "complete_visit", "high");
    expect(ready).toMatchObject({ status: "ready", tool: "complete_visit" });
  });

  it("requires a matching OpenAI function call before accepting a UI action", () => {
    const result = finalizeAgentToolDecision(
      observation({ journeyStep: "hospital" }),
      "open_current_step",
      "high",
      "openai_function_call",
    );
    expect(result).toMatchObject({
      acceptedAction: "explain_current_step",
      status: "blocked",
      reason: "invalid_tool_arguments",
      missingRequirements: ["matching_function_call"],
    });
  });

  it("uses the verified OpenAI function result instead of the final text action", () => {
    const result = finalizeAgentToolDecision(
      observation({ journeyStep: "hospital" }),
      "none",
      "low",
      "openai_function_call",
      [{
        iteration: 1,
        tool: "search_hospitals",
        requestedAction: "open_current_step",
        acceptedAction: "open_current_step",
        status: "ready",
        reason: "ready",
        missingRequirements: [],
        requiresConfirmation: false,
      }],
    );
    expect(result).toMatchObject({
      requestedAction: "open_current_step",
      acceptedAction: "open_current_step",
      status: "ready",
      runtime: "openai_function_call",
      iterations: 1,
    });
  });

  it("preserves a blocked native function result for the client", () => {
    const result = finalizeAgentToolDecision(
      observation({ journeyStep: "appointment" }),
      "explain_current_step",
      "high",
      "openai_function_call",
      [{
        iteration: 1,
        tool: "open_appointment_slots",
        requestedAction: "open_current_step",
        acceptedAction: "explain_current_step",
        status: "blocked",
        reason: "hospital_not_selected",
        missingRequirements: ["selected_hospital"],
        requiresConfirmation: false,
      }],
    );
    expect(result).toMatchObject({
      requestedAction: "open_current_step",
      acceptedAction: "explain_current_step",
      status: "blocked",
      reason: "hospital_not_selected",
      missingRequirements: ["selected_hospital"],
    });
  });
});
