import { documentPrivacyCopy } from "../documentPrivacy";
import { useI18n } from "../i18n";
import "../documentPrivacy.css";

export function DocumentConsent({ checked, onChange, disabled = false, compact = false }: {
  checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; compact?: boolean;
}) {
  const { locale } = useI18n();
  const copy = documentPrivacyCopy(locale);
  const retention = <small>{copy.retention} <a href="https://developers.openai.com/api/docs/guides/your-data" target="_blank" rel="noreferrer">{copy.policy}</a></small>;
  return <div className="document-consent">
    {!compact && <p>{copy.notice}</p>}
    <label><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><span>{copy.consent}</span></label>
    {compact ? <details><summary>{copy.details}</summary><p>{copy.notice}</p>{retention}</details> : retention}
  </div>;
}
