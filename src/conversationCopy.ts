export interface ConversationCopy {
  clear: string;
  clearConfirm: string;
  cleared: string;
  clearFailed: string;
}

const copies: Record<string, ConversationCopy> = {
  en: {
    clear: "Clear conversation",
    clearConfirm: "Clear this conversation history? Your medical card and visit progress will stay unchanged.",
    cleared: "Conversation history cleared",
    clearFailed: "Could not clear the conversation. Please try again.",
  },
  "zh-CN": {
    clear: "清空对话",
    clearConfirm: "要清空当前对话记录吗？就诊卡和就医进度不会被删除。",
    cleared: "对话记录已清空",
    clearFailed: "无法清空对话，请重试。",
  },
  ko: {
    clear: "대화 초기화",
    clearConfirm: "현재 대화 기록을 초기화할까요? 진료카드와 병원 방문 진행 상태는 유지됩니다.",
    cleared: "대화 기록을 초기화했습니다",
    clearFailed: "대화 기록을 초기화하지 못했습니다. 다시 시도해 주세요.",
  },
};

export function conversationCopy(locale: string): ConversationCopy {
  return copies[locale] || copies.en;
}
