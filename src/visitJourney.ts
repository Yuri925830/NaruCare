export const visitJourneySteps = [
  "symptoms",
  "hospital",
  "appointment",
  "companion",
  "prepare",
  "navigation",
  "translation",
  "complete",
] as const;

export type VisitJourneyStep = typeof visitJourneySteps[number];

export const companionDecisions = ["pending", "use", "skip"] as const;
export type CompanionDecision = typeof companionDecisions[number];

export function visitJourneyStepIndex(step: VisitJourneyStep) {
  return visitJourneySteps.indexOf(step);
}

export function furthestVisitJourneyStep(current: VisitJourneyStep, candidate: VisitJourneyStep) {
  return visitJourneyStepIndex(candidate) > visitJourneyStepIndex(current) ? candidate : current;
}

export function isVisitJourneyStepUnlocked(current: VisitJourneyStep, target: VisitJourneyStep) {
  return visitJourneyStepIndex(target) <= visitJourneyStepIndex(current);
}

export function companionDecisionFromText(value: string): Exclude<CompanionDecision, "pending"> | null {
  const text = value.trim().toLowerCase();
  if (!text) return null;
  if (/(?:혼자\s*(?:갈|가|방문)|동행(?:인)?\s*(?:없이|안\s*(?:쓸|할|이용))|自己去|不(?:用|需要|想要)?陪诊|without\s+(?:a\s+)?companion|go\s+alone)/iu.test(text)) return "skip";
  if (/(?:동행(?:인|통역)?(?:이)?\s*(?:필요|이용|추천|찾)|陪诊(?:师)?|need\s+(?:a\s+)?companion|want\s+(?:a\s+)?companion|find\s+(?:a\s+)?companion)/iu.test(text)) return "use";
  return null;
}
