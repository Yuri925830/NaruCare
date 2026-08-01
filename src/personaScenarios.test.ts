import { describe, expect, it } from "vitest";
import {
  clinicianUtterance,
  doctorPersonaById,
  doctorPersonas,
  hospitalStaffPersonas,
  patientPersonaById,
  patientPersonas,
  personaScenarios,
  staffPersonaById,
} from "./personaScenarios";
import { companionPersonaFor, companionPersonaProfiles } from "./companionPersonas";
import { companions } from "./data";
import { assessMedicalIntent } from "./triage";

function expectUniqueIds(items: Array<{ id: string }>) {
  const ids = items.map((item) => item.id);
  expect(new Set(ids).size).toBe(ids.length);
}

describe("persona scenario fixtures", () => {
  it("has unique patient, doctor, staff, companion persona, and scenario ids", () => {
    expectUniqueIds(patientPersonas);
    expectUniqueIds(doctorPersonas);
    expectUniqueIds(hospitalStaffPersonas);
    expectUniqueIds(companionPersonaProfiles.map((profile) => ({ id: profile.key })));
    expectUniqueIds(personaScenarios);
  });

  it("connects every scenario to real personas and utterances", () => {
    for (const scenario of personaScenarios) {
      expect(patientPersonaById(scenario.patientId), scenario.id).toBeDefined();
      expect(companions.find((companion) => companion.id === scenario.companionId), scenario.id).toBeDefined();
      expect(companionPersonaFor(scenario.companionId, "ko"), scenario.id).toBeDefined();
      expect(doctorPersonaById(scenario.doctorId), scenario.id).toBeDefined();
      for (const staffId of scenario.staffIds) expect(staffPersonaById(staffId), `${scenario.id}:${staffId}`).toBeDefined();
      for (const turn of scenario.clinicalTurns) {
        expect(clinicianUtterance(turn.speakerId, turn.utteranceId), `${scenario.id}:${turn.utteranceId}`).toBeDefined();
      }
    }
  });

  it("assigns a complete, safety-bounded persona to every companion", () => {
    expect(companionPersonaProfiles).toHaveLength(8);
    for (const companion of companions) {
      const persona = companionPersonaFor(companion.id, "ko");
      expect(persona, companion.id).toBeDefined();
      expect(persona?.strengths.length, companion.id).toBeGreaterThanOrEqual(3);
      expect(persona?.safetyBoundaries.length, companion.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("pairs each patient scenario with a companion who speaks the patient's language", () => {
    for (const scenario of personaScenarios) {
      const patient = patientPersonaById(scenario.patientId);
      const companion = companions.find((item) => item.id === scenario.companionId);
      expect(patient, scenario.id).toBeDefined();
      expect(companion, scenario.id).toBeDefined();
      expect(companion?.languages, scenario.id).toContain(patient?.locale);
      expect(companion?.languages, scenario.id).toContain("ko");
    }
  });

  it("routes every scripted patient turn to its expected intent", () => {
    for (const scenario of personaScenarios) {
      const history: string[] = [];
      for (const turn of scenario.patientTurns) {
        const result = assessMedicalIntent(turn.message, history);
        expect(result.intent, `${scenario.id}: ${turn.message}`).toBe(turn.expectedIntent);
        if (turn.expectedReason) expect(result.reason, `${scenario.id}: ${turn.message}`).toBe(turn.expectedReason);
        history.push(turn.message);
      }
    }
  });

  it("marks all critical clinician terms as literal source content", () => {
    for (const scenario of personaScenarios) {
      for (const turn of scenario.clinicalTurns) {
        const utterance = clinicianUtterance(turn.speakerId, turn.utteranceId);
        expect(utterance).toBeDefined();
        for (const term of utterance?.mustPreserve || []) {
          expect(utterance?.korean, `${scenario.id}:${turn.utteranceId}:${term}`).toContain(term);
        }
      }
    }
  });

  it("gives every emergency scenario an immediate-action contract", () => {
    const emergencyScenarios = personaScenarios.filter((scenario) => scenario.patientTurns.some((turn) => turn.expectedIntent === "emergency"));
    expect(emergencyScenarios.length).toBeGreaterThanOrEqual(2);
    for (const scenario of emergencyScenarios) {
      expect(scenario.successCriteria.join(" ")).toMatch(/119|응급/);
      expect(scenario.forbiddenOutcomes.length).toBeGreaterThan(0);
    }
  });

  it("covers every patient and clinical role in a complete matrix", () => {
    expect(new Set(personaScenarios.map((scenario) => scenario.patientId))).toEqual(new Set(patientPersonas.map((persona) => persona.id)));
    expect(new Set(personaScenarios.map((scenario) => scenario.doctorId))).toEqual(new Set(doctorPersonas.map((persona) => persona.id)));
    expect(new Set(personaScenarios.flatMap((scenario) => scenario.staffIds)).size).toBe(hospitalStaffPersonas.length);
  });
});
