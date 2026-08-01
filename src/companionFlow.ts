export interface CompanionFlowCopy {
  journeyLabel: string;
  journeyPrompt: string;
  decideCompanion: string;
  decisionTitle: string;
  decisionDesc: string;
  useCompanion: string;
  skipCompanion: string;
  useConfirmed: string;
  skipConfirmed: string;
  continuePreparation: string;
}

const copies: Record<string, CompanionFlowCopy> = {
  en: {
    journeyLabel: "Choose companion support",
    journeyPrompt: "Hospital selected. Before preparing to leave, choose whether you want an in-person companion for this visit.",
    decideCompanion: "Choose companion support",
    decisionTitle: "Would you like a companion for this visit?",
    decisionDesc: "A companion can help with registration, moving through the hospital and communication. You can also continue on your own with Naru translation.",
    useCompanion: "Find a companion",
    skipCompanion: "Continue without a companion",
    useConfirmed: "Okay. I will ask for your preferences and recommend suitable companions.",
    skipConfirmed: "Okay. We will continue without a companion. Naru translation remains available throughout the visit.",
    continuePreparation: "Continue visit preparation",
  },
  "zh-CN": {
    journeyLabel: "选择陪诊",
    journeyPrompt: "医院已选择。出发准备前，请选择本次就诊是否需要真人陪诊。",
    decideCompanion: "选择是否使用陪诊",
    decisionTitle: "本次就诊需要真人陪诊吗？",
    decisionDesc: "陪诊师可以协助挂号、院内移动和沟通。您也可以不使用陪诊，继续使用 Naru 翻译。",
    useCompanion: "推荐陪诊师",
    skipCompanion: "不使用陪诊，继续",
    useConfirmed: "好的。我会先了解您的条件，再推荐合适的陪诊师。",
    skipConfirmed: "好的。本次将不使用真人陪诊，Naru 翻译仍可继续使用。",
    continuePreparation: "继续就诊准备",
  },
  ko: {
    journeyLabel: "동행 결정",
    journeyPrompt: "병원을 선택했습니다. 출발 준비 전에 이번 방문에서 동행인을 이용할지 선택해 주세요.",
    decideCompanion: "동행 여부 선택",
    decisionTitle: "이번 병원 방문에 동행인이 필요한가요?",
    decisionDesc: "동행인은 접수, 병원 내 이동과 의사소통을 도와드립니다. 동행인 없이 Naru 통역만 이용해도 됩니다.",
    useCompanion: "동행인 추천받기",
    skipCompanion: "동행인 없이 계속",
    useConfirmed: "좋아요. 원하는 조건을 확인한 뒤 알맞은 동행인을 추천해 드릴게요.",
    skipConfirmed: "알겠습니다. 이번 방문은 동행인 없이 진행하고, 필요한 통역은 Naru가 계속 도와드릴게요.",
    continuePreparation: "방문 준비 계속",
  },
};

export function companionFlowCopy(locale: string): CompanionFlowCopy {
  return copies[locale] || copies.en;
}
