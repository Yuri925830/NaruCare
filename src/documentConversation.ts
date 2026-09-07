/** Only the active document is attached to this conversation; never add it to general chat memory. */
export interface DocumentConversationContext {
  id: string;
  name: string;
  sourceText: string;
  sourceLanguage: string;
}

export interface DocumentConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface DocumentQuestionInput {
  message: string;
  locale: string;
  history: DocumentConversationMessage[];
  sourceText: string;
  sourceLanguage: string;
}

export interface DocumentQuestionResponse { reply: string }

export const DOCUMENT_QUESTION_MAX_LENGTH = 2_000;
export const DOCUMENT_CONVERSATION_HISTORY_LIMIT = 12;

/** Keep complete recent turns within the server's 48k-character history budget. */
export function documentConversationHistory(messages: DocumentConversationMessage[]): DocumentConversationMessage[] {
  let start = messages.length;
  let characters = 0;
  for (let index = messages.length - 2; index >= 0 && messages.length - index <= DOCUMENT_CONVERSATION_HISTORY_LIMIT; index -= 2) {
    const question = messages[index];
    const answer = messages[index + 1];
    if (question.role !== "user" || answer.role !== "assistant" || question.content.length > 12_000 || answer.content.length > 12_000) break;
    const turnLength = question.content.length + answer.content.length;
    if (characters + turnLength > 48_000) break;
    characters += turnLength;
    start = index;
  }
  return messages.slice(start);
}
