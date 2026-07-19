import type { MedicalIntent, SymptomStatus } from "./triage";

export type ReasoningTier = "light" | "deep";

export interface ReasoningAssessment {
  intent: MedicalIntent;
  confidence: "high" | "medium" | "low";
  symptomStatus: SymptomStatus;
  symptoms: string;
}

export interface ReasoningDecision {
  tier: ReasoningTier;
  reasons: string[];
}

interface ReasoningContext {
  message: string;
  history: string[];
  assessment: ReasoningAssessment;
}

const SIMPLE_SOCIAL = /^(?:hi|hello|hey|thanks?|thank\s+you|bye|goodbye|ok|okay|yes|no|你好|您好|嗨|谢谢|多谢|再见|好的|好|可以|行|嗯|你是谁|你叫什么|你能做什么|안녕(?:하세요)?|감사(?:합니다|해요)?|네|아니요|こんにちは|ありがとう|はい|いいえ)[!！?.。\s]*$/iu;
const CONTEXT_DEPENDENT = /(?:但是|但|不过|可是|虽然|然而|仍然|还是|又|之前|后来|刚才|继续|不再|反而|另外|同时|如果|那么|所以|不是.{0,20}而是|它|这个|那个|上述|前面|刚刚|but|however|although|still|again|earlier|before|after|continue|instead|also|meanwhile|if|then|therefore|that|it|the\s+above|그런데|하지만|그래도|아직|다시|전에|계속|만약|でも|しかし|まだ|また|さっき|続け)/iu;
const MULTI_STEP = /(?:首先|然后|接着|最后|先.{0,40}再|一步一步|比较|对比|分别|方案|计划|first|then|next|finally|step\s+by\s+step|compare|versus|plan|pros?\s+and\s+cons?|먼저|그다음|마지막|비교|계획|まず|次に|最後|比較|計画)/iu;
const HIGH_STAKES_MEDICAL = /(?:药|用药|处方|剂量|停药|减药|换药|相互作用|副作用|过敏|怀孕|孕妇|哺乳|婴儿|儿童|老人|慢性病|肝|肾|抗凝|胰岛素|抗生素|安眠药|精神科|自杀|medicine|medication|drug|prescription|dose|dosage|stop\s+taking|interaction|side\s+effect|allerg|pregnan|breastfeed|infant|child|elderly|chronic|liver|kidney|anticoagul|insulin|antibiotic|sleeping\s+pill|psychiatr|suicid|약|복용|처방|용량|부작용|상호작용|임신|수유|어린이|노인|만성|간|신장|항응고|인슐린|항생제|수면제|薬|服用|処方|用量|副作用|相互作用|妊娠|授乳|子供|高齢|慢性|肝臓|腎臓|抗凝固|インスリン|抗生物質|睡眠薬)/iu;
const MULTIPLE_SYMPTOM_LINK = /(?:又|还|并且|以及|同时|伴有|加上|而且|但|却|、|，.{0,40}，|and|plus|with|along\s+with|as\s+well\s+as|but|또|그리고|동시에|동반|하지만|と|さらに|同時に|伴う|しかし)/iu;
const DURATION_OR_CHANGE = /(?:\d+\s*(?:分钟|小时|天|周|月|年|minutes?|hours?|days?|weeks?|months?|years?|분|시간|일|주|개월|년|分|時間|日|週間|か月|年)|越来越|恶化|加重|缓解|减轻|反复|持续|worsen|improv|recur|persist|越来越|심해|악화|호전|반복|지속|悪化|改善|繰り返|続い)/iu;

function normalizedLength(value: string) {
  return [...value.normalize("NFKC").replace(/\s+/g, " ").trim()].length;
}

/**
 * Selects the least expensive reasoning tier that can safely handle the
 * lightweight model's understanding pass. The light pass is therefore the
 * first semantic judge; deterministic signals only escalate when ambiguity,
 * medical risk, or real context synthesis makes deeper reasoning worthwhile.
 */
export function selectReasoningTier({ message, history, assessment }: ReasoningContext): ReasoningDecision {
  const text = message.normalize("NFKC").replace(/\s+/g, " ").trim();
  const reasons: string[] = [];
  const hasHistory = history.some((entry) => entry.trim().length > 0);
  const length = normalizedLength(text);

  if (SIMPLE_SOCIAL.test(text) && (!hasHistory || assessment.intent === "general")) {
    return { tier: "light", reasons: ["simple_conversation"] };
  }

  if (assessment.intent === "emergency") reasons.push("emergency_risk");
  if (assessment.confidence === "low") reasons.push("low_confidence");
  if (assessment.symptomStatus === "unknown") reasons.push("uncertain_symptom_state");
  if (HIGH_STAKES_MEDICAL.test(text)) reasons.push("high_stakes_medical_topic");

  const contextDependent = hasHistory && CONTEXT_DEPENDENT.test(text);
  if (contextDependent) reasons.push("context_dependent_follow_up");
  if (MULTI_STEP.test(text)) reasons.push("multi_step_or_comparison");
  if (length > 180) reasons.push("long_request");

  if (assessment.intent === "education") {
    if (length > 110) reasons.push("complex_medical_question");
  }

  if (assessment.intent === "hospital") {
    if (assessment.symptomStatus === "improving" || assessment.symptomStatus === "ongoing") reasons.push("evolving_symptom_state");
    if (MULTIPLE_SYMPTOM_LINK.test(text) && DURATION_OR_CHANGE.test(text)) reasons.push("multi_factor_symptom_assessment");
    if (length > 120) reasons.push("detailed_personal_health_report");
  }

  return reasons.length ? { tier: "deep", reasons } : { tier: "light", reasons: ["bounded_low_risk_task"] };
}
