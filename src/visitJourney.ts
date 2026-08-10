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

export type JourneyChatAction =
  | "open_current_step"
  | "explain_current_step"
  | "change_hospital"
  | "skip_appointment"
  | "use_companion"
  | "skip_companion"
  | "confirm_arrival"
  | "complete_visit";

export type JourneyModelAction = "none" | JourneyChatAction;

export function visitJourneyStepIndex(step: VisitJourneyStep) {
  return visitJourneySteps.indexOf(step);
}

export function furthestVisitJourneyStep(current: VisitJourneyStep, candidate: VisitJourneyStep) {
  return visitJourneyStepIndex(candidate) > visitJourneyStepIndex(current) ? candidate : current;
}

export function isVisitJourneyStepUnlocked(current: VisitJourneyStep, target: VisitJourneyStep) {
  return visitJourneyStepIndex(target) <= visitJourneyStepIndex(current);
}

export function isJourneyChatActionAllowed(step: VisitJourneyStep, action: JourneyChatAction) {
  if (action === "explain_current_step") return true;
  if (action === "open_current_step") return step !== "complete";
  if (action === "change_hospital") return step !== "symptoms" && step !== "complete";
  if (action === "skip_appointment") return step === "appointment";
  if (action === "use_companion" || action === "skip_companion") return step === "companion";
  if (action === "confirm_arrival") return step === "navigation";
  return step === "translation";
}

export function journeyChatActionRequiresHighConfidence(action: JourneyChatAction) {
  return action !== "open_current_step" && action !== "explain_current_step";
}

export function companionDecisionFromText(value: string): Exclude<CompanionDecision, "pending"> | null {
  const text = value.trim().toLowerCase();
  if (!text) return null;
  if (/(?:혼자\s*(?:갈|가|방문)|동행(?:인)?\s*(?:없이|안\s*(?:쓸|할|이용))|自己去|不(?:用|需要|想要)?陪诊|without\s+(?:a\s+)?companion|go\s+alone)/iu.test(text)) return "skip";
  if (/(?:동행(?:인|통역)?(?:이)?\s*(?:필요|이용|추천|찾)|陪诊(?:师)?|need\s+(?:a\s+)?companion|want\s+(?:a\s+)?companion|find\s+(?:a\s+)?companion)/iu.test(text)) return "use";
  return null;
}

/**
 * Maps short, natural chat commands to the action that is valid at the
 * current visit step. State-changing actions stay deterministic instead of
 * trusting a free-form model response.
 */
export function journeyChatActionFromText(step: VisitJourneyStep, value: string): JourneyChatAction | null {
  const text = value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
  if (!text) return null;

  const wantsAnotherHospital = /(?:다른\s*병원|병원(?:을|으로)?\s*(?:바꾸|변경|다시\s*찾)|change\s+(?:the\s+)?hospital|another\s+hospital|换(?:一?家)?医院|更换医院)/iu.test(text);
  if (step !== "symptoms" && step !== "complete" && wantsAnotherHospital) return "change_hospital";

  const wantsNext = /^(?:다음(?:\s*단계)?|계속(?:\s*진행)?|진행해|넘어가|next|continue|go\s+on|下一步|继续|繼續)[.!?\s]*$/iu.test(text);

  if (step === "symptoms") {
    return wantsNext ? "explain_current_step" : null;
  }
  if (step === "hospital") {
    if (wantsNext || /(?:병원\s*(?:찾|검색|추천)|주변\s*병원|가까운\s*병원|find\s+(?:a\s+)?hospital|nearby\s+hospital|找医院|附近医院)/iu.test(text)) return "open_current_step";
    return null;
  }
  if (step === "appointment" || step === "companion") {
    return wantsNext ? "explain_current_step" : null;
  }
  if (step === "prepare") {
    if (wantsNext || /(?:준비(?:물)?\s*(?:확인|시작|체크|하러)|준비\s*(?:다\s*)?(?:했|끝|완료)|다\s*챙겼|visit\s+preparation|check\s+(?:my\s+)?items|准备(?:好了|完成|物品)?)/iu.test(text)) return "open_current_step";
    return null;
  }
  if (step === "navigation") {
    if (/(?:병원에?\s*)?도착(?:했|함|완료)|(?:i(?:'ve|\s+have)?\s*)?arrived|到医院了|已经到了/iu.test(text)) return "confirm_arrival";
    if (wantsNext || /(?:출발|길\s*안내|경로|지도|병원\s*(?:가자|갈게|이동)|directions?|navigation|route|depart|出发|导航|路线)/iu.test(text)) return "open_current_step";
    return null;
  }
  if (step === "translation") {
    if (/(?:(?:진료|통역|상담)\s*(?:끝|종료|완료|마쳤)|finish(?:ed)?\s+(?:the\s+)?visit|end\s+(?:the\s+)?translation|就诊结束|看完医生了|翻译结束)/iu.test(text)) return "complete_visit";
    if (wantsNext || /(?:통역\s*(?:시작|열|해줘)|접수\s*도와|의료진\s*(?:대화|통역)|translation|interpreter|翻译|口译)/iu.test(text)) return "open_current_step";
    return null;
  }
  return null;
}
