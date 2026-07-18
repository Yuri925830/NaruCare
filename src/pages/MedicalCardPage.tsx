import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { BadgeCheck, Languages, LocateFixed, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { Button, InfoBanner, NaruPose, Panel } from "../components";
import { localeOptions, useI18n } from "../i18n";
import type { MedicalCard } from "../types";

const koreanLabels: Record<keyof MedicalCard, string> = {
  name: "이름 / 호칭", nationality: "국적", age: "나이", gender: "성별", documentType: "신분증 종류",
  address: "현재 거주지 (선택)", documentNumber: "신분증 번호", insurance: "한국 건강보험", conditions: "만성질환 / 알레르기",
  medications: "현재 복용 약물", surgeries: "수술 / 중요 병력", notes: "기타 메모", language: "주요 통역 언어", korean: "한국어 번역",
};

function emptyCard(language: string): MedicalCard {
  return { name: "", nationality: "", address: "", age: "", gender: "female", documentType: "alien", documentNumber: "", insurance: "yes", conditions: "", medications: "", surgeries: "", notes: "", language };
}

export function MedicalCardPage({ card, onSaved }: { card: MedicalCard | null; onSaved: (card: MedicalCard) => void }) {
  const { locale, t } = useI18n();
  const [form, setForm] = useState<MedicalCard>(() => card || emptyCard(locale));
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [saved, setSaved] = useState(Boolean(card));
  const [error, setError] = useState("");

  useEffect(() => { if (card) { setForm(card); setSaved(true); } }, [card]);
  const fields = useMemo(() => [
    { key: "name", label: t("name"), required: true },
    { key: "nationality", label: t("nationality"), required: true },
    { key: "address", label: t("residentialAddress"), placeholder: t("addressOptional") },
    { key: "age", label: t("age"), type: "number", required: true },
    { key: "gender", label: t("gender"), options: [["female", t("female")], ["male", t("male")], ["other", t("other")]] },
    { key: "documentType", label: t("documentType"), options: [["alien", t("alienRegistration")], ["passport", t("passport")]] },
    { key: "documentNumber", label: t("documentNumber"), required: true },
    { key: "insurance", label: t("insurance"), options: [["yes", t("yes")], ["no", t("no")]] },
    { key: "conditions", label: t("conditions"), placeholder: t("none") },
    { key: "medications", label: t("medications"), placeholder: t("none") },
    { key: "surgeries", label: t("surgeries"), placeholder: t("none") },
    { key: "notes", label: t("notes"), placeholder: t("none") },
    { key: "language", label: t("primaryLanguage"), options: localeOptions.map((item) => [item.code, item.nativeName]) },
  ] as const, [t]);

  const locateAddress = useCallback(async () => {
    setLocationError("");
    if (!navigator.geolocation) { setLocationError(t("locationDenied")); return; }
    setLocating(true);
    try {
      const point = await new Promise<{ lat: number; lng: number }>((resolve, reject) => navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }), reject,
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
      ));
      const address = await api.reverseGeocode(point.lat, point.lng);
      setForm((current) => ({ ...current, address }));
    } catch { setLocationError(t("locationDenied")); }
    finally { setLocating(false); }
  }, [t]);

  useEffect(() => { if (!card?.address) void locateAddress(); }, []);

  function localKoreanValue(key: string, value: string) {
    const common: Record<string, string> = { female: "여성", male: "남성", other: "기타 / 공개 안 함", alien: "외국인등록증", passport: "여권", yes: "있음", no: "없음", None: "없음", 无: "없음", "": "없음" };
    if (key === "language") return localeOptions.find((item) => item.code === value)?.nativeName || value;
    return common[value] || value;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const textKeys = ["address", "conditions", "medications", "surgeries", "notes"] as const;
      const translated = await Promise.all(textKeys.map(async (key) => [key, await api.translate(form[key] || t("none"), form.language, "ko")] as const));
      const korean: Record<string, string> = Object.fromEntries(fields.map((field) => [field.key, localKoreanValue(field.key, form[field.key] || t("none"))]));
      translated.forEach(([key, value]) => { korean[key] = value; });
      const result = await api.saveCard({ ...form, korean });
      setForm(result); setSaved(true); onSaved(result);
    } catch { setError(t("errorGeneric")); }
    finally { setSaving(false); }
  }

  return <Panel className="medical-card-panel">
    <InfoBanner title={t("personalCard")} icon="shield" action={<div className="banner-character"><span className="soft-chip">{t("editable")}</span><NaruPose pose={4} className="medical-card-naru" /></div>}>{t("cardPrivacy")}</InfoBanner>
    {saved && <div className="bilingual-heading"><Languages size={20} /><div><strong>{t("bilingualCard")}</strong><small>{t("userLanguage")} · {localeOptions.find((item) => item.code === form.language)?.nativeName} / 한국어</small></div></div>}
    <form className="medical-card-form" onSubmit={submit}>
      {fields.map((field) => {
        const key = field.key as keyof MedicalCard;
        const value = String(form[key] ?? "");
        const options = "options" in field ? field.options : null;
        return <label key={key}>
          <span>{field.label}{saved && <em> / {koreanLabels[key]}</em>}</span>
          {options ? <select value={value} onChange={(event) => setForm({ ...form, [key]: event.target.value })}>{options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select> : <input type={("type" in field && field.type) || "text"} min={key === "age" ? 0 : undefined} max={key === "age" ? 120 : undefined} value={value} onChange={(event) => setForm({ ...form, [key]: event.target.value })} placeholder={("placeholder" in field && field.placeholder) || ""} required={"required" in field && field.required} />}
          {key === "address" && <><Button type="button" variant="secondary" className="locate-address" onClick={() => void locateAddress()} disabled={locating}><LocateFixed size={16} />{locating ? t("locating") : t("useCurrentLocation")}</Button><small className="address-help">{t("addressHelp")}</small>{locationError && <small className="form-error" role="alert">{locationError}</small>}</>}
          {saved && <small className="korean-preview"><BadgeCheck size={13} />{form.korean?.[key] || localKoreanValue(key, value)}</small>}
        </label>;
      })}
      {error && <p className="form-error span-2">{error}</p>}
      <p className="card-footer"><ShieldCheck size={15} />{t("cardFooter")}</p>
      <Button type="submit" disabled={saving}><ShieldCheck size={19} />{saving ? t("loading") : t("submitCard")}</Button>
    </form>
  </Panel>;
}
