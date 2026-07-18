import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { AppShell, LanguageSelector, NaruPose, Panel } from "./components";
import { getDefaultFilters } from "./data";
import { I18nProvider, useI18n } from "./i18n";
import { AuthPage } from "./pages/AuthPage";
import { AgentPage, HospitalsPage, NavigationPage, TranslationPage, VisitFlowPage } from "./pages/CarePages";
import {
  CompanionArrivedPage, CompanionChatPage, CompanionDetailPage, CompanionFilterPage, CompanionFinishedPage,
  CompanionListPage, CompanionNoticePage, CompanionPaymentPage, CompanionServicePage, CompanionWaitingPage,
} from "./pages/CompanionPages";
import { EmergencyCallingPage, EmergencyConfirmPage, ProfilePage, RecordsPage } from "./pages/EmergencyProfilePages";
import { MedicalCardPage } from "./pages/MedicalCardPage";
import type { Companion, CompanionFilters, CompanionOrder, Hospital, LocationState, SessionUser, View } from "./types";

export function App() {
  return <I18nProvider><AppInner /></I18nProvider>;
}

function AppInner() {
  const { locale, t } = useI18n();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState<View>("agent");
  const [languageReturn, setLanguageReturn] = useState<View>("agent");
  const [gateSignal, setGateSignal] = useState(0);
  const [location, setLocation] = useState<LocationState>({ lat: 37.5665, lng: 126.978, address: "서울특별시", verified: false });
  const [symptoms, setSymptoms] = useState("");
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [filters, setFilters] = useState<CompanionFilters>(() => getDefaultFilters(locale));
  const [people, setPeople] = useState<Companion[]>(api.allCompanions);
  const [selectedCompanion, setSelectedCompanion] = useState<Companion>(api.allCompanions[0]);
  const [order, setOrder] = useState<CompanionOrder | null>(null);
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
  const [recordsCount, setRecordsCount] = useState(0);

  useEffect(() => { void api.me().then((current) => { if (current) setUser(current); }).finally(() => setChecking(false)); }, []);
  useEffect(() => { if (user) { void refreshLocation(); void api.records().then((records) => setRecordsCount(records.length)); } }, [user?.id]);

  const refreshLocation = useCallback(async (): Promise<LocationState> => {
    if (!navigator.geolocation) return location;
    const point = await new Promise<{ lat: number; lng: number } | null>((resolve) => navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 },
    ));
    if (!point) return location;
    const address = await api.reverseGeocode(point.lat, point.lng);
    const next = { ...point, address, verified: true };
    setLocation(next);
    return next;
  }, [location.lat, location.lng]);

  const openHospitals = useCallback(async (nextSymptoms: string) => {
    setSymptoms(nextSymptoms || symptoms);
    setHospitalsLoading(true);
    setHospitals([]);
    setSelectedHospital(null);
    setView("hospitals");
    try {
      const current = await refreshLocation();
      const results = current.verified ? await api.hospitals(current.lat, current.lng, nextSymptoms || symptoms, locale) : [];
      setHospitals(results);
      setSelectedHospital(results[0] || null);
    } finally { setHospitalsLoading(false); }
  }, [locale, refreshLocation, symptoms]);

  function navigate(next: View) {
    if (!user) return;
    const allowedWithoutCard: View[] = ["agent", "card", "emergency-confirm", "emergency-calling", "language"];
    if (!user.card && !allowedWithoutCard.includes(next)) {
      setView("agent");
      setGateSignal((value) => value + 1);
      return;
    }
    setView(next);
  }

  function openLanguage() { setLanguageReturn(view); setView("language"); }

  async function match() {
    setView("companions");
    setPeople(await api.getCompanions(filters));
  }

  async function applyForCompanion(person = selectedCompanion) {
    setSelectedCompanion(person);
    const created = await api.createOrder({ companion: person, hospital: selectedHospital, status: "requested", durationMinutes: 120, deposit: Math.round(person.price * 2 * .1), paymentMethod: "" });
    setOrder(created);
    setView("companion-waiting");
  }

  async function acceptOrder() {
    if (!order) return;
    const updated = { ...order, status: "accepted" as const };
    setOrder(updated); setView("companion-payment");
    await api.updateOrder(order.id, "accepted");
  }

  async function payDeposit(method: string) {
    if (!order) return;
    const updated = { ...order, status: "deposit_paid" as const, paymentMethod: method };
    setOrder(updated); setView("companion-arrived");
    await api.updateOrder(order.id, "deposit_paid", { paymentMethod: method, amount: order.deposit });
  }

  async function endService() {
    if (!order) return;
    const updated = { ...order, status: "completed" as const };
    setOrder(updated); setView("companion-finished");
    await api.updateOrder(order.id, "completed");
    await api.addRecord({ hospital: order.hospital?.name || t("hospital"), department: "내과 / Internal Medicine", symptoms: symptoms || t("unknown"), date: new Date().toISOString().slice(0, 10).replaceAll("-", "."), status: t("serviceFinished") });
    setRecordsCount((value) => value + 1);
  }

  async function submitCompanionReview(rating: number, review: string) {
    if (order) await api.updateOrder(order.id, "completed", { rating, review });
    setView("records");
  }

  const titles: Record<View, string> = {
    agent: "Naru", card: t("createCard"), hospitals: t("nearbyHospitals"), "visit-flow": t("navFlow"), navigation: t("navigationRoute"), translation: t("translationConversation"),
    "companions-notice": t("companionsNotice"), "companions-filter": t("companionConditions"), companions: t("companionsTitle"), "companion-detail": t("companionDetail"), "companion-chat": t("companionChat"),
    "companion-waiting": t("waitingConfirmation"), "companion-payment": t("payDeposit"), "companion-arrived": t("companionArrived"), "companion-service": t("serviceInProgress"), "companion-finished": t("serviceFinished"),
    "emergency-confirm": t("emergencyCall"), "emergency-calling": t("calling119"), profile: t("profileTitle"), records: t("recordsTitle"), language: t("chooseLanguage"),
  };

  if (checking) return <div className="app-loading"><NaruPose pose={2} /><span>{t("loading")}</span></div>;
  if (!user) return <AuthPage onAuthenticated={(current) => { setUser(current); setView("agent"); }} />;

  let content: React.ReactNode;
  switch (view) {
    case "card": content = <MedicalCardPage card={user.card} onSaved={(card) => { setUser({ ...user, card }); setView("agent"); }} />; break;
    case "agent": content = <AgentPage card={user.card} onCard={() => setView("card")} onEmergency={(value) => { setSymptoms(value); setView("emergency-confirm"); }} onHospitals={openHospitals} onFlow={() => setView("visit-flow")} onTranslation={() => setView("translation")} onCompanion={() => setView("companions-notice")} gateSignal={gateSignal} />; break;
    case "hospitals": content = <HospitalsPage location={location} hospitals={hospitals} loading={hospitalsLoading} selected={selectedHospital} onSelect={setSelectedHospital} onFlow={() => setView("visit-flow")} onCompanion={() => setView("companions-notice")} onRoute={() => setView("navigation")} onRefresh={async () => { setHospitalsLoading(true); try { const next = await refreshLocation(); const results = next.verified ? await api.hospitals(next.lat, next.lng, symptoms, locale) : []; setHospitals(results); setSelectedHospital(results[0] || null); } finally { setHospitalsLoading(false); } }} />; break;
    case "visit-flow": content = <VisitFlowPage onStart={() => selectedHospital ? setView("navigation") : void openHospitals(symptoms)} />; break;
    case "navigation": content = selectedHospital ? <NavigationPage location={location} hospital={selectedHospital} onArrived={() => setView("translation")} onTranslation={() => setView("translation")} /> : <Panel><p>{t("noHospitalsFound")}</p></Panel>; break;
    case "translation": content = <TranslationPage userLanguage={user.card?.language || locale} />; break;
    case "companions-notice": content = <CompanionNoticePage onContinue={() => setView("companions-filter")} />; break;
    case "companions-filter": content = <CompanionFilterPage filters={filters} onChange={setFilters} onMatch={() => void match()} />; break;
    case "companions": content = <CompanionListPage people={people} onFilters={() => setView("companions-filter")} onDetail={(person) => { setSelectedCompanion(person); setView("companion-detail"); }} onChoose={(person) => { setSelectedCompanion(person); setView("companion-chat"); }} />; break;
    case "companion-detail": content = <CompanionDetailPage person={selectedCompanion} onChat={() => setView("companion-chat")} onApply={() => void applyForCompanion()} />; break;
    case "companion-chat": content = <CompanionChatPage person={selectedCompanion} hospitalName={selectedHospital?.name || t("hospital")} onApply={() => void applyForCompanion()} />; break;
    case "companion-waiting": content = order ? <CompanionWaitingPage person={order.companion} onAccepted={() => void acceptOrder()} onMessage={() => setView("companion-chat")} onCancel={() => { void api.updateOrder(order.id, "cancelled"); setOrder(null); setView("companions"); }} /> : <Panel />; break;
    case "companion-payment": content = order ? <CompanionPaymentPage order={order} onPay={(method) => void payDeposit(method)} /> : <Panel />; break;
    case "companion-arrived": content = order ? <CompanionArrivedPage order={order} onMet={(stream) => { setRecordingStream(stream); setOrder({ ...order, status: "in_service" }); setView("companion-service"); void api.updateOrder(order.id, "in_service"); }} onProblem={() => setView("companion-chat")} /> : <Panel />; break;
    case "companion-service": content = order ? <CompanionServicePage order={order} stream={recordingStream} onEnd={() => void endService()} /> : <Panel />; break;
    case "companion-finished": content = order ? <CompanionFinishedPage order={order} onPayBalance={() => void api.updateOrder(order.id, "completed", { balancePaid: true })} onReview={(rating, review) => void submitCompanionReview(rating, review)} /> : <Panel />; break;
    case "emergency-confirm": content = <EmergencyConfirmPage hasCard={Boolean(user.card)} onCall={() => { void refreshLocation(); setView("emergency-calling"); }} onDecline={() => user.card ? void openHospitals(symptoms) : setView("card")} />; break;
    case "emergency-calling": content = <EmergencyCallingPage user={user} location={location} symptoms={symptoms} onTranslation={() => setView("translation")} onEnd={() => setView(user.card ? "agent" : "card")} />; break;
    case "profile": content = <ProfilePage user={user} recordsCount={recordsCount} onCard={() => setView("card")} onRecords={() => setView("records")} onLanguage={openLanguage} onLogout={() => { void api.logout(); setUser(null); }} />; break;
    case "records": content = <RecordsPage />; break;
    case "language": content = <Panel className="in-app-language"><h2>{t("chooseLanguage")}</h2><p>{t("languageSubtitle")}</p><LanguageSelector compact onDone={() => setView(languageReturn)} /></Panel>; break;
    default: content = null;
  }

  return <AppShell view={view} title={titles[view]} user={user} onNavigate={navigate} onLanguage={openLanguage}>{content}</AppShell>;
}
