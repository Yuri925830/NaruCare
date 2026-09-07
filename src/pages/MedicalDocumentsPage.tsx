import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { AlertCircle, ArrowRight, Camera, Check, Download, FileText, ImagePlus, Languages, LoaderCircle, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { api, ApiError } from "../api";
import { Button, NaruPose, Panel } from "../components";
import { localeOptions, useI18n } from "../i18n";
import { medicalDocumentCopy, type MedicalDocumentCopy } from "../medicalDocumentCopy";
import { MAX_MEDICAL_DOCUMENT_TEXT, MEDICAL_DOCUMENT_ACCEPT, MEDICAL_PHOTO_ACCEPT, medicalDocumentFileError, type MedicalDocument, type MedicalDocumentSummary } from "../medicalDocuments";
import "../medicalDocuments.css";

type BusyStep = "uploading" | "translating" | "loading" | "deleting" | "downloading";
type Failure = { error: unknown; retry?: () => void };

function errorMessage(error: unknown, copy: MedicalDocumentCopy): string {
  const code = typeof error === "string" ? error : error instanceof ApiError ? error.code : "";
  if (error instanceof ApiError && error.status === 401) return copy.signInAgain;
  switch (code) {
    case "document_too_large": return copy.tooLarge;
    case "invalid_document": return copy.invalidFile;
    case "unsupported_document_type": return copy.unsupportedFile;
    case "document_text_too_long": case "text_too_long": return copy.textTooLong;
    case "invalid_document_translation": case "invalid_language": case "invalid_source_text": case "invalid_translation_input": return copy.languageError;
    case "document_not_found": case "document_file_not_found": return copy.notFound;
    case "not_found": case "document_service_unavailable": case "document_storage_unavailable": case "ai_unavailable": case "ai_not_configured": case "document_ai_unavailable": return copy.serviceUnavailable;
    case "document_text_empty": return copy.emptyText;
    case "document_extraction_failed": case "document_extraction_incomplete": case "document_processing_failed": case "document_unreadable": case "ocr_failed": return copy.processingError;
    case "document_translation_failed": case "document_translation_incomplete": case "translation_failed": return copy.translationError;
    case "document_changed": return copy.documentChanged;
    case "demo_document_unavailable": case "document_demo_unavailable": case "backend_required": return copy.demoHelp;
    case "camera_denied": return copy.cameraDenied;
    case "camera_unavailable": return copy.cameraUnavailable;
  }
  if (error instanceof ApiError && [404, 501, 503].includes(error.status)) return copy.serviceUnavailable;
  if (error instanceof TypeError || (error instanceof DOMException && error.name === "AbortError")) return copy.networkError;
  return copy.generalError;
}

function readableSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Allow the browser to start consuming the Blob before releasing the URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function MedicalDocumentsPage({ active = true, userLanguage }: { active?: boolean; userLanguage?: string }) {
  const { locale } = useI18n();
  const copy = medicalDocumentCopy(locale);
  const demo = api.isDemo();
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [targetLanguage, setTargetLanguage] = useState(() => localeOptions.find((item) => item.code === (userLanguage || locale))?.code || "en");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [current, setCurrent] = useState<MedicalDocument | null>(null);
  const [sourceText, setSourceText] = useState("");
  const [history, setHistory] = useState<MedicalDocumentSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<unknown>(null);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState<BusyStep | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFailure, setCameraFailure] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const captureInput = useRef<HTMLInputElement>(null);
  const cameraDialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const cameraGeneration = useRef(0);
  const historyGeneration = useRef(0);
  const busyLock = useRef(false);
  const mounted = useRef(true);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const cameraCaptureLock = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!selectedFile || !(/image\/(jpeg|png)/.test(selectedFile.type) || /\.(jpe?g|png)$/i.test(selectedFile.name))) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  useEffect(() => {
    if (!active || demo) return;
    const generation = ++historyGeneration.current;
    setHistoryLoading(true);
    setHistoryError(null);
    void api.documents().then((documents) => {
      if (generation === historyGeneration.current) setHistory(documents);
    }).catch((error: unknown) => {
      if (generation === historyGeneration.current) setHistoryError(error);
    }).finally(() => {
      if (generation === historyGeneration.current) setHistoryLoading(false);
    });
    return () => { historyGeneration.current++; };
  }, [active, demo, refresh]);

  useEffect(() => {
    if (!active) setCameraOpen(false);
  }, [active]);

  useEffect(() => {
    if (!cameraOpen || !active) return;
    const dialog = cameraDialog.current;
    const generation = ++cameraGeneration.current;
    let disposed = false;
    cameraCaptureLock.current = false;
    setCameraReady(false);
    setCameraFailure(null);
    if (dialog && !dialog.open) dialog.showModal();
    const stop = () => {
      disposed = true;
      cameraGeneration.current++;
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      if (video.current) video.current.srcObject = null;
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
        setCameraOpen(false);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("camera_unavailable");
        const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } } });
        if (disposed || generation !== cameraGeneration.current) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = media;
        if (video.current) {
          video.current.srcObject = media;
          await video.current.play();
        }
      } catch (error) {
        if (disposed || generation !== cameraGeneration.current) return;
        stream.current?.getTracks().forEach((track) => track.stop());
        stream.current = null;
        setCameraFailure(error instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(error.name) ? "camera_denied" : "camera_unavailable");
      }
    })();
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      if (dialog?.open) dialog.close();
    };
  }, [cameraOpen, active]);

  const languageLabel = (value: string) => value === "auto" ? copy.autoLanguage : localeOptions.find((item) => item.code === value)?.nativeName || value;
  const translationCurrent = Boolean(current?.translatedText && current.sourceText === sourceText && current.sourceLanguage === sourceLanguage && current.targetLanguage === targetLanguage);
  const editable = !busy;

  function updateHistory(document: MedicalDocument) {
    historyGeneration.current++;
    setHistoryLoading(false);
    setHistoryError(null);
    setHistory((items) => [document, ...items.filter((item) => item.id !== document.id)]);
  }

  async function perform(step: BusyStep, work: () => Promise<void>, retry: () => void) {
    if (busyLock.current) return;
    busyLock.current = true;
    setBusy(step);
    setFailure(null);
    try { await work(); }
    catch (error) { if (mounted.current) setFailure({ error, retry }); }
    finally {
      busyLock.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  function chooseFile(file: File | undefined) {
    if (!file || busyLock.current) return;
    const error = medicalDocumentFileError(file);
    if (error) {
      setFailure({ error });
      return;
    }
    setFailure(null);
    setSelectedFile(file);
    setCurrent(null);
    setSourceText("");
    setDeleteId(null);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
  }

  function startCamera() {
    setFailure(null);
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (mobile) captureInput.current?.click();
    else setCameraOpen(true);
  }

  function capturePhoto() {
    const element = video.current;
    if (!element || !cameraReady || cameraCaptureLock.current || !element.videoWidth || !element.videoHeight) return;
    cameraCaptureLock.current = true;
    const generation = cameraGeneration.current;
    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      cameraCaptureLock.current = false;
      setCameraFailure("camera_unavailable");
      return;
    }
    context.drawImage(element, 0, 0);
    canvas.toBlob((blob) => {
      cameraCaptureLock.current = false;
      if (!mounted.current || generation !== cameraGeneration.current) return;
      if (!blob) { setCameraFailure("camera_unavailable"); return; }
      chooseFile(new File([blob], `medical-document-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`, { type: "image/jpeg" }));
      setCameraOpen(false);
    }, "image/jpeg", 0.94);
  }

  function upload() {
    if (!selectedFile || demo) return;
    const file = selectedFile;
    void perform("uploading", async () => {
      const result = await api.uploadDocument(file, sourceLanguage, targetLanguage);
      if (!mounted.current) return;
      setCurrent(result);
      setSourceText(result.sourceText);
      setSourceLanguage(result.sourceLanguage);
      setTargetLanguage(result.targetLanguage);
      updateHistory(result);
      window.requestAnimationFrame(() => reviewHeading.current?.focus());
    }, upload);
  }

  function translate() {
    if (!current || demo || !sourceText.trim() || sourceText.length > MAX_MEDICAL_DOCUMENT_TEXT) return;
    const document = current;
    const input = { sourceText, sourceLanguage, targetLanguage };
    void perform("translating", async () => {
      const result = await api.translateDocument(document.id, input);
      if (!mounted.current) return;
      setCurrent(result);
      setSourceText(result.sourceText);
      setSourceLanguage(result.sourceLanguage);
      setTargetLanguage(result.targetLanguage);
      updateHistory(result);
    }, translate);
  }

  function openDocument(id: string) {
    void perform("loading", async () => {
      const result = await api.document(id);
      if (!mounted.current) return;
      setCurrent(result);
      setSelectedFile(null);
      setSourceText(result.sourceText);
      setSourceLanguage(result.sourceLanguage);
      setTargetLanguage(result.targetLanguage);
      setDeleteId(null);
      window.requestAnimationFrame(() => reviewHeading.current?.focus());
    }, () => openDocument(id));
  }

  function deleteDocument(id: string) {
    void perform("deleting", async () => {
      await api.deleteDocument(id);
      if (!mounted.current) return;
      historyGeneration.current++;
      setHistoryLoading(false);
      setHistory((items) => items.filter((item) => item.id !== id));
      if (current?.id === id) { setCurrent(null); setSelectedFile(null); setSourceText(""); }
      setDeleteId(null);
    }, () => deleteDocument(id));
  }

  function downloadOriginal() {
    if (!current) return;
    const document = current;
    void perform("downloading", async () => {
      const blob = await api.documentFile(document.id);
      if (mounted.current) saveBlob(blob, document.name);
    }, downloadOriginal);
  }

  function downloadTranslation() {
    if (!current || !translationCurrent) return;
    const text = `${current.name}\n${languageLabel(current.sourceLanguage)} → ${languageLabel(current.targetLanguage)}\n\n${copy.sourceText}\n${current.sourceText}\n\n${copy.translation}\n${current.translatedText}\n\n${copy.clinicalNote}\n`;
    saveBlob(new Blob(["\uFEFF", text], { type: "text/plain;charset=utf-8" }), `${current.name.replace(/\.[^.]+$/, "")}-${current.targetLanguage}.txt`);
  }

  return <div className="medical-documents">
    <Panel className="medical-document-upload">
      <div className="medical-document-intro">
        <div className="medical-document-intro-copy"><span className="medical-document-eyebrow"><FileText size={16} />NaruCare</span><h2>{copy.introduction}</h2><p>{copy.subtitle}</p></div>
        <div className="medical-document-illustration" aria-hidden="true"><span className="medical-document-paper"><FileText size={23} /><i /><i /><i /></span><NaruPose pose={3} className="medical-document-naru" /><span className="medical-document-language-badge"><Languages size={21} /></span></div>
      </div>
      <ol className="medical-document-steps" aria-label={copy.title}>
        {[copy.stepUpload, copy.stepReview, copy.stepTranslate].map((label, index) => <li key={label} className={(translationCurrent ? 2 : current ? 1 : 0) === index ? "active" : ""} aria-current={(translationCurrent ? 2 : current ? 1 : 0) === index ? "step" : undefined}><span>{index + 1}</span>{label}</li>)}
      </ol>
      {demo && <div className="medical-document-notice" role="status"><AlertCircle size={20} /><div><strong>{copy.demoTitle}</strong><p>{copy.demoHelp}</p></div></div>}
      <div className="medical-document-upload-options">
        <button type="button" disabled={Boolean(busy)} onClick={startCamera}><span className="medical-document-option-icon"><Camera size={25} /></span><strong>{copy.takePhoto}</strong><small>{copy.takePhotoHelp}</small></button>
        <button type="button" disabled={Boolean(busy)} onClick={() => photoInput.current?.click()}><span className="medical-document-option-icon"><ImagePlus size={25} /></span><strong>{copy.uploadPhoto}</strong><small>{copy.uploadPhotoHelp}</small></button>
        <button type="button" disabled={Boolean(busy)} onClick={() => fileInput.current?.click()}><span className="medical-document-option-icon"><Upload size={25} /></span><strong>{copy.uploadFile}</strong><small>{copy.uploadFileHelp}</small></button>
      </div>
      <input ref={captureInput} type="file" accept={MEDICAL_PHOTO_ACCEPT} capture="environment" aria-label={copy.takePhoto} className="medical-document-file-input" onChange={onFileChange} disabled={Boolean(busy)} />
      <input ref={photoInput} type="file" accept={MEDICAL_PHOTO_ACCEPT} aria-label={copy.uploadPhoto} className="medical-document-file-input" onChange={onFileChange} disabled={Boolean(busy)} />
      <input ref={fileInput} type="file" accept={MEDICAL_DOCUMENT_ACCEPT} aria-label={copy.uploadFile} className="medical-document-file-input" onChange={onFileChange} disabled={Boolean(busy)} />
      <p className="medical-document-formats">{copy.formats}</p>
      <div className="medical-document-languages">
        <label>{copy.sourceLanguage}<select value={sourceLanguage} disabled={!editable} onChange={(event) => { setSourceLanguage(event.target.value); setFailure(null); }}><option value="auto">{copy.autoLanguage}</option>{localeOptions.map((option) => <option key={option.code} value={option.code}>{option.nativeName}</option>)}</select></label>
        <ArrowRight size={20} aria-hidden="true" />
        <label>{copy.targetLanguage}<select value={targetLanguage} disabled={!editable} onChange={(event) => { setTargetLanguage(event.target.value); setFailure(null); }}>{localeOptions.map((option) => <option key={option.code} value={option.code}>{option.nativeName}</option>)}</select></label>
      </div>
      {selectedFile && <div className="medical-document-selected">
        {previewUrl ? <a href={previewUrl} target="_blank" rel="noreferrer" aria-label={copy.preview}><img src={previewUrl} alt={copy.preview} /></a> : <span className="medical-document-file-icon"><FileText size={32} /></span>}
        <div><small>{copy.selectedFile}</small><strong>{selectedFile.name}</strong><span>{readableSize(selectedFile.size)}</span></div>
        {!current && <button type="button" className="medical-document-icon-button" aria-label={copy.removeFile} disabled={Boolean(busy)} onClick={() => { setSelectedFile(null); setFailure(null); }}><X size={19} /></button>}
      </div>}
      {!current && selectedFile && (selectedFile.type === "application/pdf" || /\.pdf$/i.test(selectedFile.name)) && <p className="medical-document-review-help">{copy.pdfHelp}</p>}
      {selectedFile && !current && <Button className="medical-document-upload-submit" disabled={Boolean(busy) || demo} onClick={upload}>{busy === "uploading" ? <LoaderCircle className="medical-document-spinner" size={19} /> : <Upload size={19} />}{busy === "uploading" ? copy.uploading : copy.upload}</Button>}
      <p className="medical-document-privacy">{copy.uploadPrivacy}</p>
    </Panel>

    {busy && <div className="medical-document-progress" role="status" aria-live="polite"><LoaderCircle className="medical-document-spinner" size={19} />{copy[busy]}</div>}
    {failure && <div className="medical-document-error" role="alert"><AlertCircle size={21} /><div><strong>{copy.errorTitle}</strong><p>{errorMessage(failure.error, copy)}</p></div>{failure.retry && <Button variant="ghost" disabled={Boolean(busy)} onClick={failure.retry}>{copy.retry}</Button>}</div>}

    {current && <Panel className="medical-document-review">
      <div className="medical-document-section-heading"><div><h2 ref={reviewHeading} tabIndex={-1}>{copy.reviewTitle}</h2><p>{current.name}</p></div><Button variant="ghost" disabled={Boolean(busy)} onClick={downloadOriginal}><Download size={17} />{copy.originalDownload}</Button></div>
      <p className="medical-document-review-help">{copy.reviewHelp}</p>
      {current.mimeType === "application/pdf" && <p className="medical-document-review-help">{copy.pdfHelp}</p>}
      <div className="medical-document-text-columns">
        <div className="medical-document-source"><label htmlFor="medical-document-source-text"><FileText size={17} />{copy.sourceText}<span>{languageLabel(sourceLanguage)}</span></label><textarea id="medical-document-source-text" value={sourceText} onChange={(event) => { setSourceText(event.target.value); setFailure(null); }} disabled={Boolean(busy)} maxLength={MAX_MEDICAL_DOCUMENT_TEXT} placeholder={copy.emptyText} aria-describedby="medical-document-text-count" dir="auto" /><small id="medical-document-text-count">{copy.characterCount.replace("{count}", sourceText.length.toLocaleString(locale))}</small></div>
        <div className="medical-document-result"><div className="medical-document-result-label"><Languages size={18} />{copy.translation}<span>{languageLabel(translationCurrent ? current.targetLanguage : targetLanguage)}</span></div>{translationCurrent ? <div className="medical-document-translated-text" dir="auto">{current.translatedText}</div> : <div className="medical-document-translation-empty"><Languages size={34} /><p>{current.translatedText ? copy.translationChanged : copy.translationEmpty}</p></div>}</div>
      </div>
      <div className="medical-document-review-actions"><Button disabled={Boolean(busy) || demo || !sourceText.trim() || sourceText.length > MAX_MEDICAL_DOCUMENT_TEXT} onClick={translate}>{busy === "translating" ? <LoaderCircle className="medical-document-spinner" size={19} /> : <Languages size={19} />}{busy === "translating" ? copy.translating : copy.translate}</Button>{translationCurrent && <><span className="medical-document-complete" role="status"><Check size={16} />{copy.translationReady}</span><Button variant="ghost" disabled={Boolean(busy)} onClick={downloadTranslation}><Download size={17} />{copy.translationDownload}</Button></>}</div>
      <p className="medical-document-clinical-note">{copy.clinicalNote}</p>
    </Panel>}

    <Panel className="medical-document-history">
      <div className="medical-document-section-heading"><div><h2>{copy.historyTitle}</h2><p>{copy.historyHelp}</p></div><Button variant="ghost" disabled={historyLoading || Boolean(busy) || demo} onClick={() => setRefresh((value) => value + 1)} aria-label={copy.refresh}><RefreshCw size={17} className={historyLoading ? "medical-document-spinner" : undefined} />{copy.refresh}</Button></div>
      {Boolean(historyError) && <div className="medical-document-error" role="alert"><AlertCircle size={20} /><p>{errorMessage(historyError, copy)}</p><Button variant="ghost" disabled={historyLoading || Boolean(busy)} onClick={() => setRefresh((value) => value + 1)}>{copy.retry}</Button></div>}
      {historyLoading && <p className="medical-document-history-loading" role="status"><LoaderCircle className="medical-document-spinner" size={17} />{copy.loading}</p>}
      {!history.length && !historyLoading && !historyError && <div className="medical-document-empty-history"><NaruPose pose={1} className="medical-document-empty-naru" /><div><strong>{copy.emptyHistory}</strong><p>{copy.emptyHistoryHelp}</p></div></div>}
      {history.length > 0 && <ul className="medical-document-history-list">{history.map((item) => <li key={item.id} className={current?.id === item.id ? "selected" : ""}>
        <div className="medical-document-history-row"><span className="medical-document-history-icon"><FileText size={22} /></span><div className="medical-document-history-info"><strong>{item.name}</strong><small><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString(locale)}</time><span>·</span>{readableSize(item.size)}<span>·</span>{languageLabel(item.sourceLanguage)} → {languageLabel(item.targetLanguage)}</small></div><span className={`medical-document-state ${item.status === "translated" ? "translated" : ""}`}>{item.status === "translated" ? copy.translated : copy.saved}</span><div className="medical-document-history-actions"><Button variant="ghost" disabled={Boolean(busy)} onClick={() => openDocument(item.id)} aria-label={`${copy.open}: ${item.name}`}>{copy.open}</Button><button className="medical-document-icon-button" type="button" disabled={Boolean(busy)} onClick={() => setDeleteId(deleteId === item.id ? null : item.id)} aria-label={`${copy.delete}: ${item.name}`} aria-expanded={deleteId === item.id}><Trash2 size={18} /></button></div></div>
        {deleteId === item.id && <div className="medical-document-delete-confirm"><p>{copy.confirmDelete}</p><Button variant="danger" disabled={Boolean(busy)} onClick={() => deleteDocument(item.id)}>{copy.delete}</Button><Button variant="ghost" disabled={Boolean(busy)} onClick={() => setDeleteId(null)}>{copy.cancel}</Button></div>}
      </li>)}</ul>}
    </Panel>

    {cameraOpen && <dialog ref={cameraDialog} className="medical-document-camera" aria-labelledby="medical-document-camera-title" aria-describedby="medical-document-camera-help" onCancel={() => setCameraOpen(false)}>
      <div className="medical-document-section-heading"><h2 id="medical-document-camera-title">{copy.cameraTitle}</h2><button type="button" className="medical-document-icon-button" aria-label={copy.cancel} onClick={() => setCameraOpen(false)} autoFocus><X size={21} /></button></div>
      <p id="medical-document-camera-help">{copy.cameraHelp}</p>
      <div className="medical-document-viewfinder"><video ref={video} autoPlay muted playsInline onLoadedData={() => setCameraReady(true)} aria-label={copy.preview} />{!cameraReady && !cameraFailure && <div role="status"><LoaderCircle className="medical-document-spinner" size={24} /><span>{copy.cameraStarting}</span></div>}</div>
      {cameraFailure && <p className="medical-document-camera-error" role="alert">{errorMessage(cameraFailure, copy)}</p>}
      <div className="medical-document-camera-actions"><Button disabled={!cameraReady || Boolean(cameraFailure)} onClick={capturePhoto}><Camera size={19} />{copy.capture}</Button><Button variant="ghost" onClick={() => { setCameraOpen(false); captureInput.current?.click(); }}>{copy.cameraFallback}</Button></div>
    </dialog>}
  </div>;
}
