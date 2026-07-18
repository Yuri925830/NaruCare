import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CreditCard, Globe2, Languages, MapPin, PhoneCall, ShieldCheck, UserRound, Volume2 } from "lucide-react";
import { api } from "../api";
import { Button, InfoBanner, NaruPose, Panel, StatusPill } from "../components";
import { buildKorean119Message, fallbackEmergencySymptomsKorean, isUsableKoreanTranslation } from "../emergencyKorean";
import { useI18n } from "../i18n";
import type { LocationState, MedicalCard, SessionUser, VisitRecord } from "../types";

export function EmergencyConfirmPage({ hasCard, onCall, onDecline }: { hasCard: boolean; onCall: () => void; onDecline: () => void }) {
  const { t } = useI18n();
  function call() {
    onCall();
    window.setTimeout(() => { window.location.href = "tel:119"; }, 80);
  }
  return <Panel className="emergency-confirm-panel"><div className="emergency-illustration"><div><AlertCircle /></div><NaruPose pose={7} className="emergency-confirm-naru" /></div><div className="emergency-copy"><strong>{t("dangerDetected")}</strong><h2>{t("emergencyQuestion")}</h2><InfoBanner tone="red" icon="location" title={t("emergencyActions")}>{t("emergencyActionsDesc")}</InfoBanner><Button variant="danger" onClick={call}><PhoneCall />{t("needCallNow")}</Button><Button variant="ghost" onClick={onDecline}>{t("declineCall")}</Button><p>{t("emergencyNoCardHint")}</p>{!hasCard && <StatusPill tone="red">{t("cardMissingShort")}</StatusPill>}</div></Panel>;
}

export function EmergencyCallingPage({ user, location, symptoms, onTranslation, onEnd }: { user: SessionUser; location: LocationState; symptoms: string; onTranslation: () => void; onEnd: () => void }) {
  const { locale, t } = useI18n();
  const [looping, setLooping] = useState(false);
  const [cycle, setCycle] = useState(0);
  const name = user.card?.name || user.id || "UU";
  const coordinates = location.verified ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}${location.accuracy ? ` (±${Math.round(location.accuracy)}m)` : ""}` : "";
  const displayAddress = location.verified ? `${location.address} · GPS ${coordinates}` : user.card?.address?.trim() || t("locationDenied");
  const spokenAddress = location.verified ? `${location.address}, GPS 좌표 ${coordinates}` : user.card?.korean?.address?.trim() || user.card?.address?.trim() || "위치 확인 불가";
  const symptomText = user.card && symptoms && symptoms !== t("unknown") ? symptoms : "";
  const fallbackKoreanSymptoms = useMemo(() => symptomText ? fallbackEmergencySymptomsKorean(symptomText) : "", [symptomText]);
  const [koreanSymptoms, setKoreanSymptoms] = useState(fallbackKoreanSymptoms);
  const [translatingSymptoms, setTranslatingSymptoms] = useState(Boolean(symptomText));
  const korean = buildKorean119Message({ name, address: spokenAddress, koreanSymptoms: symptomText ? koreanSymptoms : undefined });
  const confirmation = t(symptomText ? "emergencyConfirmationKnown" : "emergencyConfirmationUnknown", { name, address: displayAddress, symptoms: symptomText });

  useEffect(() => {
    if (!symptomText) {
      setKoreanSymptoms("");
      setTranslatingSymptoms(false);
      return;
    }

    let active = true;
    let timeoutId = 0;
    setKoreanSymptoms(fallbackKoreanSymptoms);
    setTranslatingSymptoms(true);

    const timeout = new Promise<string>((resolve) => {
      timeoutId = window.setTimeout(() => resolve(""), 2_000);
    });
    void Promise.race([api.translate(symptomText, user.card?.language || locale, "ko"), timeout])
      .then((translated) => {
        if (active && isUsableKoreanTranslation(symptomText, translated)) setKoreanSymptoms(translated.trim());
      })
      .finally(() => {
        if (active) setTranslatingSymptoms(false);
        window.clearTimeout(timeoutId);
      });

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [fallbackKoreanSymptoms, locale, symptomText, user.card?.language]);

  useEffect(() => {
    if (!looping || translatingSymptoms) return;
    const utterance = new SpeechSynthesisUtterance(korean); utterance.lang = "ko-KR"; utterance.rate = .82; utterance.volume = 1;
    utterance.onend = () => { if (looping) window.setTimeout(() => setCycle((value) => value + 1), 700); };
    speechSynthesis.cancel(); speechSynthesis.speak(utterance);
    return () => speechSynthesis.cancel();
  }, [looping, cycle, korean, translatingSymptoms]);

  function toggleLoop() { if (!translatingSymptoms) setLooping((value) => !value); }
  function finish() { setLooping(false); speechSynthesis.cancel(); onEnd(); }

  return <Panel className="emergency-calling-panel"><div className="call-left"><NaruPose pose={8} className="emergency-calling-naru" /><div className="call-119">119</div><h2>{t("connecting119")}</h2><p>{location.verified || user.card?.address ? t("locationObtained") : t("locationDenied")}</p><div className="call-location"><MapPin /><span>{t("currentAddress")}<strong>{displayAddress}</strong></span></div><div className="call-actions"><Button variant="secondary" onClick={onTranslation}><Languages />{t("openEmergencyTranslation")}</Button><Button variant="danger" onClick={finish}><PhoneCall />{t("endCall")}</Button></div></div><div className="call-script"><strong>{looping ? t("koreanLoop") : t("startKoreanLoop")}</strong><article><p lang="ko">{korean}</p><Button variant="danger" onClick={toggleLoop} disabled={translatingSymptoms}><Volume2 />{translatingSymptoms ? t("loading") : looping ? t("autoLoop") : t("startKoreanLoop")}</Button></article><small>{t("chineseConfirmation")}</small><article><p>{confirmation}</p></article><p className="browser-note">{t("browserCallNote")}</p></div></Panel>;
}

export function ProfilePage({ user, recordsCount, onCard, onRecords, onLanguage, onLogout }: { user: SessionUser; recordsCount: number; onCard: () => void; onRecords: () => void; onLanguage: () => void; onLogout: () => void }) {
  const { option, t } = useI18n();
  const [dialog, setDialog] = useState<{ title: string; body: string } | null>(null);
  const items = [
    { icon: <CreditCard />, title: t("myMedicalCard"), sub: user.card ? t("cardCreated", { name: user.card.name }) : t("cardMissingShort"), action: onCard },
    { icon: <span>☷</span>, title: t("visitRecords"), sub: t("completedCount", { count: recordsCount }), action: onRecords },
    { icon: <UserRound />, title: t("companionOrders"), sub: t("completedCount", { count: recordsCount }), action: onRecords },
    { icon: <span>▣</span>, title: t("paymentMethods"), sub: t("notLinked"), action: () => setDialog({ title: t("paymentMethods"), body: t("paymentProtectionDesc") }) },
    { icon: <Globe2 />, title: t("languageSettings"), sub: option.nativeName, action: onLanguage },
    { icon: <ShieldCheck />, title: t("privacySecurity"), sub: t("passwordData"), action: () => setDialog({ title: t("privacySecurity"), body: t("privacyPromiseDesc") }) },
  ];
  return <><Panel className="profile-panel"><div className="profile-hero"><span>{user.card?.name?.slice(0, 2).toUpperCase() || user.id.slice(0, 2).toUpperCase()}</span><div><h2>{user.card?.name || user.id}</h2><p>{t("account", { id: user.id })}</p><StatusPill>{user.card ? t("cardCreated", { name: user.card.name }) : t("cardMissingShort")}</StatusPill></div><Button variant="ghost" onClick={onCard}>{t("editProfile")}</Button><NaruPose pose={20} className="profile-naru-pose" /></div><h3>{t("accountServices")}</h3><div className="profile-grid">{items.map((item) => <button key={item.title} onClick={item.action}><i>{item.icon}</i><strong>{item.title}<small>{item.sub}</small></strong><span>→</span></button>)}</div><div className="profile-footer"><InfoBanner tone="mint" icon="shield" title={t("privacyPromise")}>{t("privacyPromiseDesc")}</InfoBanner><Button variant="ghost" onClick={onLogout}>{t("logout")}</Button></div></Panel>{dialog && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={dialog.title}><div className="gate-modal account-dialog"><h2>{dialog.title}</h2><p>{dialog.body}</p><Button onClick={() => setDialog(null)}>{t("close")}</Button><button className="modal-close" onClick={() => setDialog(null)} aria-label={t("close")}>×</button></div></div>}</>;
}

export function RecordsPage({ version = 0 }: { version?: number }) {
  const { t } = useI18n();
  const [records, setRecords] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<{ record: VisitRecord; title: string } | null>(null);
  useEffect(() => { setLoading(true); void api.records().then(setRecords).finally(() => setLoading(false)); }, [version]);
  const displayStatus = (status: string) => {
    const keys = { searching: "recordStatusSearching", hospital_selected: "recordStatusHospitalSelected", navigating: "recordStatusNavigating", arrived: "recordStatusArrived", companion_requested: "recordStatusCompanion", completed: "recordStatusCompleted", emergency: "emergencyCall" } as const;
    return status in keys ? t(keys[status as keyof typeof keys]) : status;
  };
  const open = (record: VisitRecord, title: string) => setDetail({ record, title });
  return <><Panel className="records-panel"><InfoBanner title={t("recordsDesc")}>{t("recordsSub")}</InfoBanner>{loading ? <p>{t("loading")}</p> : records.length ? <div className="records-list">{records.map((record) => <article key={record.id}><span>{record.date}</span><StatusPill>{displayStatus(record.status)}</StatusPill><h2>{record.hospital}</h2><p dir="auto">{record.department} · {record.symptoms}</p><div><button onClick={() => open(record, t("translationRecord"))}>{t("translationRecord")}</button><button onClick={() => open(record, t("companionRecord"))}>{t("companionRecord")}</button><button onClick={() => open(record, t("feeRecord"))}>{t("feeRecord")}</button><Button onClick={() => open(record, t("viewFullRecord"))}>{t("viewFullRecord")}</Button></div></article>)}</div> : <div className="empty-records"><NaruPose pose={21} /><h2>{t("noRecords")}</h2></div>}<InfoBanner tone="mint" icon="shield" title={t("recordManaged")}>{t("exportDelete")}</InfoBanner></Panel>{detail && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={detail.title}><div className="gate-modal record-dialog"><h2>{detail.title}</h2><dl><div><dt>{t("hospital")}</dt><dd>{detail.record.hospital}</dd></div><div><dt>{t("visitRecords")}</dt><dd>{detail.record.date} · {displayStatus(detail.record.status)}</dd></div><div><dt>{t("medicalStaff")}</dt><dd>{detail.record.department}</dd></div><div><dt>{t("youSaid")}</dt><dd dir="auto">{detail.record.symptoms}</dd></div></dl><Button onClick={() => setDetail(null)}>{t("close")}</Button><button className="modal-close" onClick={() => setDetail(null)} aria-label={t("close")}>×</button></div></div>}</>;
}
