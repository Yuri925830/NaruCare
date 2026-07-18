import { useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { api, ApiError } from "../api";
import { Button, LanguageButton, LanguageSelector, NaruPose } from "../components";
import { useI18n } from "../i18n";
import type { SessionUser } from "../types";

export function AuthPage({ onAuthenticated }: { onAuthenticated: (user: SessionUser) => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [languageOpen, setLanguageOpen] = useState(false);
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 6) return setError(t("passwordShort"));
    if (mode === "register" && password !== confirm) return setError(t("passwordMismatch"));
    setBusy(true);
    try {
      const user = mode === "register" ? await api.register(id.trim(), password) : await api.login(id.trim(), password);
      onAuthenticated(user);
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : "";
      setError(code === "id_taken" ? t("idTaken") : t("authFailed"));
    } finally { setBusy(false); }
  }

  if (languageOpen) return <div className="language-page auth-language-page">
    <div className="language-page-art"><div className="brand auth-brand"><strong>NaruCare</strong><small>{t("chooseLanguage")}</small></div><NaruPose pose={1} className="language-page-naru" /></div>
    <div className="language-page-content"><h1>{t("chooseLanguage")}</h1><p>{t("languageSubtitle")}</p><LanguageSelector compact onDone={() => setLanguageOpen(false)} /></div>
  </div>;

  return <div className="auth-page">
    <aside className="auth-art">
      <div className="brand auth-brand"><strong>NaruCare</strong><small>{t("brandSub")}</small></div>
      <LanguageButton onClick={() => setLanguageOpen(true)} />
      <div className="mobile-auth-intro"><div><h2>Hi, {t("navNaru")}</h2><p>{t("brandSub")}<br />{t("loginSubtitle")}</p></div><NaruPose pose={mode === "login" ? 0 : 3} className="mobile-auth-naru" /></div>
      <NaruPose pose={mode === "login" ? 0 : 3} className="auth-naru-pose" />
    </aside>
    <main className="auth-form-wrap">
      <form className="auth-form" onSubmit={submit}>
        <h1>{mode === "login" ? t("welcomeBack") : t("createAccount")}</h1>
        <p className="auth-subtitle">{mode === "login" ? t("loginSubtitle") : t("registerSubtitle")}</p>
        {mode === "register" && <div className="privacy-notice"><ShieldCheck size={22} /><div><strong>{t("privacyTitle")}</strong><p>{t("privacyDesc")}</p></div></div>}
        <label>{t("accountId")}<input value={id} onChange={(event) => setId(event.target.value)} placeholder={t("enterId")} autoComplete="username" required minLength={2} maxLength={48} /></label>
        <label>{t("password")}<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder={t("enterPassword")} autoComplete={mode === "login" ? "current-password" : "new-password"} required /></label>
        {mode === "register" && <label>{t("confirmPassword")}<input value={confirm} onChange={(event) => setConfirm(event.target.value)} type="password" placeholder={t("confirmPasswordPh")} autoComplete="new-password" required /></label>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" disabled={busy}>{busy ? t("loading") : mode === "login" ? t("login") : t("registerLogin")}</Button>
        <button type="button" className="auth-switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
          {mode === "login" ? <>{t("noAccount")} <strong>{t("registerNow")}</strong></> : <>{t("hasAccount")} <strong>{t("goLogin")}</strong></>}
        </button>
      </form>
      <p className="auth-security"><ShieldCheck size={15} />{t("encrypted")}</p>
    </main>
  </div>;
}
