import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, FileText, LoaderCircle, MessageCircleMore, RefreshCw, Sparkles, X } from "lucide-react";
import { api, ApiError } from "../api";
import { Button, NaruPose, Panel } from "../components";
import { useI18n } from "../i18n";
import { documentConversationHistory, DOCUMENT_QUESTION_MAX_LENGTH, type DocumentConversationContext, type DocumentConversationMessage } from "../documentConversation";
import { documentConversationCopy } from "../documentConversationCopy";
import "../documentConversation.css";

interface Props {
  context: DocumentConversationContext;
  onBackToDocument: () => void;
  onDetach: () => void;
}

function ReplyText({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith("**") && part.endsWith("**")
    ? <strong key={index}>{part.slice(2, -2)}</strong> : part)}</>;
}

/** Changing the source text starts a fresh conversation before any previous reply can be shown. */
export function DocumentNaruChat(props: Props) {
  const { context } = props;
  return <DocumentNaruChatSession key={JSON.stringify([context.id, context.sourceLanguage, context.sourceText])} {...props} />;
}

function DocumentNaruChatSession({ context, onBackToDocument, onDetach }: Props) {
  const { locale } = useI18n();
  const copy = documentConversationCopy(locale);
  const [messages, setMessages] = useState<DocumentConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);

  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1_000)), 1_000);
    return () => window.clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, pendingQuestion, busy, error]);

  async function ask(value: string) {
    const question = value.trim();
    if (requestRef.current || !question || question.length > DOCUMENT_QUESTION_MAX_LENGTH) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setError("");
    setPendingQuestion(question);
    setInput("");
    try {
      const result = await api.askDocument(context.id, {
        message: question,
        locale,
        history: documentConversationHistory(messages),
        sourceText: context.sourceText,
        sourceLanguage: context.sourceLanguage,
      }, controller.signal);
      if (requestRef.current !== controller || controller.signal.aborted) return;
      if (!result?.reply?.trim()) throw new Error("empty_reply");
      setMessages((previous) => [...previous, { role: "user", content: question }, { role: "assistant", content: result.reply.trim() }]);
      setPendingQuestion("");
    } catch (cause) {
      if (requestRef.current !== controller || controller.signal.aborted) return;
      setError(cause instanceof ApiError
        ? cause.status === 401 ? copy.expired : cause.status === 404 ? copy.unavailable : cause.status === 429 ? copy.tooMany : copy.error
        : cause instanceof TypeError ? copy.offline : copy.error);
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setBusy(false);
      }
    }
  }

  const visibleMessages: DocumentConversationMessage[] = pendingQuestion ? [...messages, { role: "user", content: pendingQuestion }] : messages;
  return <Panel className="document-naru-chat">
    <header className="document-naru-header">
      <NaruPose pose={2} className="document-naru-avatar" />
      <div><strong>Naru</strong><span>{copy.subtitle}</span></div>
      <button type="button" className="document-naru-close" onClick={onDetach} title={copy.detach} aria-label={copy.detach}><X size={18} /></button>
    </header>
    <div className="document-naru-attachment">
      <span className="document-naru-attachment-icon"><FileText size={20} /></span>
      <div><small>{copy.attached}</small><strong title={context.name} dir="auto">{context.name}</strong></div>
      <button type="button" onClick={onBackToDocument}><ArrowLeft size={14} /><span>{copy.openDocument}</span></button>
    </div>
    <div ref={scrollRef} className="document-naru-messages" role="log" aria-label={copy.conversation} aria-live="polite" aria-relevant="additions text">
      <div className={`document-naru-welcome${visibleMessages.length ? " compact" : ""}`}>
        <div className="document-naru-welcome-art"><NaruPose pose={11} /><span><Sparkles size={18} /></span></div>
        <div><span className="document-naru-eyebrow"><MessageCircleMore size={14} />Naru</span><h2>{copy.title}</h2><p>{copy.welcome}</p></div>
      </div>
      {visibleMessages.map((message, index) => <article key={index} className={`document-naru-message document-naru-message-${message.role}`}>
        <strong>{message.role === "assistant" ? "Naru" : copy.you}</strong>
        <p dir="auto">{message.role === "assistant" ? <ReplyText text={message.content} /> : message.content}</p>
      </article>)}
      {busy && <div className="document-naru-thinking" role="status"><LoaderCircle size={17} /><span>{elapsed >= 20 ? copy.stillThinking : copy.thinking}</span><small aria-hidden="true">{copy.elapsed.replace("{seconds}", String(elapsed))}</small></div>}
      {error && <div className="document-naru-error" role="alert"><p>{error}</p><Button type="button" variant="ghost" onClick={() => void ask(pendingQuestion)}><RefreshCw size={15} />{copy.retry}</Button></div>}
    </div>
    <div className="document-naru-suggestions" aria-label={copy.subtitle}>
      {copy.questionLabels.map((label, index) => <button key={index} type="button" disabled={busy} onClick={() => void ask(copy.questions[index])}>{label}</button>)}
    </div>
    <form className="document-naru-composer" onSubmit={(event) => { event.preventDefault(); void ask(input); }}>
      <textarea value={input} onChange={(event) => setInput(event.target.value)} maxLength={DOCUMENT_QUESTION_MAX_LENGTH} rows={2} dir="auto" aria-label={copy.placeholder} placeholder={copy.placeholder} disabled={busy} onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && !window.matchMedia("(pointer: coarse)").matches) {
          event.preventDefault();
          void ask(input);
        }
      }} />
      <button type="submit" disabled={busy || !input.trim()} aria-label={copy.send}><ArrowUp size={21} /></button>
    </form>
    <p className="document-naru-clinical-note">{copy.clinicalNote}</p>
    <p className="document-naru-memory">{copy.memory}</p>
  </Panel>;
}
