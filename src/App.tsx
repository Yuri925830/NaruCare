import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "./api";
import { companionServiceTotal, extendCompanionDuration, MAX_COMPANION_SERVICE_MINUTES, normalizeCompanionDuration } from "./companionBilling";
import {
  appointmentDecisionComplete,
  appointmentPolicyFor,
  defaultAppointmentPreference,
  type AppointmentDecision,
  type AppointmentPreference,
  type HospitalAppointmentBooking,
  type HospitalAppointmentSlot,
} from "./hospitalAppointments";
import { AppShell, LanguageSelector, NaruPose, Panel } from "./components";
import { getDefaultFilters } from "./data";
import { I18nProvider, useI18n } from "./i18n";
import { requestFastAccurateLocation, type PreciseLocationFix } from "./location";
import { extractReportableSymptoms, isHospitalCommandWithoutSymptoms } from "./triage";
import { AuthPage } from "./pages/AuthPage";
import { AgentPage, HospitalsPage, NavigationPage, TranslationPage, VisitFlowPage } from "./pages/CarePages";
import {
  CompanionArrivedPage, CompanionChatPage, CompanionDetailPage, CompanionFilterPage, CompanionFinishedPage,
  CompanionListPage, CompanionNoticePage, CompanionPaymentPage, CompanionServicePage, CompanionWaitingPage,
} from "./pages/CompanionPages";
import { CompanionOrdersPage, EmergencyCallingPage, EmergencyConfirmPage, ProfilePage, RecordsPage } from "./pages/EmergencyProfilePages";
import { MedicalCardPage } from "./pages/MedicalCardPage";
import type { Companion, CompanionFilters, CompanionOrder, Hospital, LocationState, MedicalCard, SessionUser, View, VisitRecord, VisitRecordDetails } from "./types";
import { furthestVisitJourneyStep, visitJourneyStepIndex, type CompanionDecision, type VisitJourneyStep } from "./visitJourney";
import { clearVisitSession, loadVisitSession, saveVisitSession } from "./visitSession";

export function App() {
  return <I18nProvider><AppInner /></I18nProvider>;
}

const defaultLocation: LocationState = { lat: 37.5665, lng: 126.978, address: "서울특별시", verified: false };

function orderRecordDetails(order: CompanionOrder, status = order.status, paymentMethod = order.paymentMethod, balancePaid = Boolean(order.balancePaid)): VisitRecordDetails {
  const billableMinutes = Math.min(MAX_COMPANION_SERVICE_MINUTES, Math.max(60, order.actualDurationMinutes || order.durationMinutes));
  const serviceTotal = companionServiceTotal(order.companion.price, billableMinutes);
  const depositPaid = ["deposit_paid", "arrived", "in_service", "completed"].includes(status) ? order.deposit : 0;
  const paidBalance = balancePaid ? Math.max(0, serviceTotal - depositPaid) : 0;
  return {
    companion: {
      orderId: order.id,
      name: order.companion.name,
      status,
      durationMinutes: billableMinutes,
      hospital: order.hospital?.name || "—",
    },
    fees: {
      currency: "KRW",
      serviceTotal,
      depositPaid,
      balancePaid: paidBalance,
      balanceDue: Math.max(0, serviceTotal - depositPaid - paidBalance),
      paymentMethod,
      status: balancePaid ? "paid" : depositPaid ? "deposit_paid" : "unpaid",
    },
  };
}

function AppInner() {
  const { locale, t } = useI18n();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState<View>("agent");
  const [viewHistory, setViewHistory] = useState<View[]>([]);
  const [visitedViews, setVisitedViews] = useState<View[]>(["agent"]);
  const [gateSignal, setGateSignal] = useState(0);
  const [location, setLocation] = useState<LocationState>(defaultLocation);
  const [symptoms, setSymptoms] = useState("");
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [hospitalConfirmed, setHospitalConfirmed] = useState(false);
  const [appointmentPreference, setAppointmentPreference] = useState<AppointmentPreference>(() => defaultAppointmentPreference());
  const [appointmentDecision, setAppointmentDecision] = useState<AppointmentDecision>("pending");
  const [appointmentBooking, setAppointmentBooking] = useState<HospitalAppointmentBooking | null>(null);
  const [journeyStep, setJourneyStep] = useState<VisitJourneyStep>("symptoms");
  const [companionDecision, setCompanionDecision] = useState<CompanionDecision>("pending");
  const [filters, setFilters] = useState<CompanionFilters>(() => getDefaultFilters(locale));
  const [people, setPeople] = useState<Companion[]>(api.allCompanions);
  const [selectedCompanion, setSelectedCompanion] = useState<Companion>(api.allCompanions[0]);
  const [companionDurationMinutes, setCompanionDurationMinutes] = useState(120);
  const [order, setOrder] = useState<CompanionOrder | null>(null);
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
  const [recordsCount, setRecordsCount] = useState(0);
  const [recordsVersion, setRecordsVersion] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [ordersVersion, setOrdersVersion] = useState(0);
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);
  const [visitSessionVersion, setVisitSessionVersion] = useState(0);
  const [visitSessionOwnerId, setVisitSessionOwnerId] = useState<string | null>(null);
  const symptomSaveVersion = useRef(0);
  const bestLocationAccuracy = useRef(Number.POSITIVE_INFINITY);
  const locationRequestVersion = useRef(0);
  const advanceJourney = useCallback((candidate: VisitJourneyStep) => {
    setJourneyStep((current) => furthestVisitJourneyStep(current, candidate));
  }, []);

  useEffect(() => { void api.me().then((current) => { if (current) setUser(current); }).finally(() => setChecking(false)); }, []);
  useEffect(() => {
    if (!user) {
      setVisitSessionOwnerId(null);
      return;
    }
    const saved = loadVisitSession(user.id);
    if (saved) {
      setSymptoms(saved.symptoms);
      setHospitals(saved.hospitals);
      const savedHospital = saved.hospitals.find((hospital) => hospital.id === saved.selectedHospitalId) || null;
      const confirmedHospital = saved.hospitalConfirmed ? savedHospital : null;
      setSelectedHospital(confirmedHospital);
      setHospitalConfirmed(Boolean(confirmedHospital));
      setAppointmentPreference(saved.appointmentPreference);
      setAppointmentDecision(saved.appointmentDecision);
      setAppointmentBooking(saved.appointmentBooking);
      setCompanionDecision(saved.companionDecision);
      setJourneyStep(saved.journeyStep);
      setCurrentRecordId(saved.currentRecordId);
    } else {
      setSymptoms("");
      setHospitals([]);
      setSelectedHospital(null);
      setHospitalConfirmed(false);
      setAppointmentPreference(defaultAppointmentPreference());
      setAppointmentDecision("pending");
      setAppointmentBooking(null);
      setCompanionDecision("pending");
      setJourneyStep("symptoms");
      setCurrentRecordId(null);
    }
    setVisitSessionOwnerId(user.id);
  }, [user?.id]);
  useEffect(() => {
    if (!user || visitSessionOwnerId !== user.id) return;
    saveVisitSession(user.id, {
      symptoms,
      hospitals,
      selectedHospitalId: selectedHospital?.id || null,
      hospitalConfirmed,
      appointmentPreference,
      appointmentDecision,
      appointmentBooking,
      companionDecision,
      journeyStep,
      currentRecordId,
    });
  }, [appointmentBooking, appointmentDecision, appointmentPreference, companionDecision, currentRecordId, hospitalConfirmed, hospitals, journeyStep, selectedHospital?.id, symptoms, user?.id, visitSessionOwnerId]);
  useEffect(() => {
    if (!user) return;
    void refreshLocation();
    void Promise.all([api.records(), api.orders()]).then(([records, orders]) => { setRecordsCount(records.length); setOrdersCount(orders.length); });
  }, [user?.id]);
  useEffect(() => {
    const card = user?.card;
    if (!card || !isHospitalCommandWithoutSymptoms(card.symptoms || "")) return;
    const cleanedCard: MedicalCard = { ...card, symptoms: "", korean: { ...(card.korean || {}), symptoms: "" } };
    setUser((current) => current?.card?.symptoms === card.symptoms ? { ...current, card: cleanedCard } : current);
    void api.saveCard(cleanedCard).catch(() => undefined);
  }, [user?.card?.symptoms]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [view]);

  const goTo = useCallback((next: View, options?: { replace?: boolean }) => {
    setView((current) => {
      if (current === next) return current;
      if (!options?.replace) setViewHistory((history) => [...history, current]);
      setVisitedViews((visited) => visited.includes(next) ? visited : [...visited, next]);
      return next;
    });
  }, []);

  const goBack = useCallback(() => {
    setViewHistory((history) => {
      const previous = history.at(-1) || "agent";
      setView(previous);
      return history.slice(0, -1);
    });
  }, []);

  const refreshLocation = useCallback(async (): Promise<LocationState> => {
    if (!navigator.geolocation) return location;
    const requestVersion = ++locationRequestVersion.current;
    const toLocation = async (point: PreciseLocationFix) => {
      const reverseAddress = await api.reverseGeocode(point.lat, point.lng);
      const fallback: LocationState = { ...point, address: reverseAddress, verified: true };
      if (requestVersion !== locationRequestVersion.current || point.accuracy >= bestLocationAccuracy.current) return fallback;
      const card = user?.card;
      const closeToSavedAddress = Boolean(card?.latitude && card?.longitude
        && Math.abs(card.latitude - point.lat) < 0.0007
        && Math.abs(card.longitude - point.lng) < 0.0009);
      const address = closeToSavedAddress && card?.address?.trim() ? card.address.trim() : reverseAddress;
      const next: LocationState = { ...point, address, verified: true };
      bestLocationAccuracy.current = point.accuracy;
      setLocation(next);
      return next;
    };
    try {
      bestLocationAccuracy.current = Number.POSITIVE_INFINITY;
      const point = await requestFastAccurateLocation(navigator.geolocation, {
        usableAccuracyMeters: 25,
        precisionTargetMeters: 8,
        firstFixTimeoutMs: 7_000,
        refinementTimeoutMs: 10_000,
        onRefined: (refined) => { void toLocation(refined); },
      });
      return await toLocation(point);
    } catch {
      const card = user?.card;
      if (card?.latitude && card?.longitude) {
        const saved: LocationState = { lat: card.latitude, lng: card.longitude, address: card.address || `${card.latitude}, ${card.longitude}`, accuracy: card.locationAccuracy, verified: true };
        setLocation(saved);
        return saved;
      }
      return location;
    }
  }, [location, user?.card]);

  const captureSymptoms = useCallback(async (text: string) => {
    const clean = extractReportableSymptoms(text);
    if (!clean || clean === t("unknown")) return;
    setSymptoms(clean);
    advanceJourney("hospital");
    const card = user?.card;
    if (!card || card.symptoms === clean) return;
    const saveVersion = ++symptomSaveVersion.current;
    const nextCard: MedicalCard = { ...card, symptoms: clean, korean: { ...(card.korean || {}), symptoms: "" } };
    setUser((current) => current ? { ...current, card: nextCard } : current);
    try {
      // Persist the user's own-language symptom description first, so the
      // consent prompt never waits for an AI translation round trip.
      await api.saveCard(nextCard);
      void (async () => {
        try {
          const koreanSymptoms = await api.translate(clean, card.language || locale, "ko");
          if (symptomSaveVersion.current !== saveVersion) return;
          const translated: MedicalCard = { ...nextCard, korean: { ...(nextCard.korean || {}), symptoms: koreanSymptoms } };
          setUser((current) => current?.card?.symptoms === clean ? { ...current, card: translated } : current);
          await api.saveCard(translated);
        } catch { /* The original-language symptom is already safely stored. */ }
      })();
    } catch {
      await api.saveCard(nextCard).catch(() => undefined);
    }
  }, [advanceJourney, locale, t, user?.card]);

  const clearCurrentSymptoms = useCallback(async () => {
    setSymptoms("");
    setHospitals([]);
    setSelectedHospital(null);
    setAppointmentPreference(defaultAppointmentPreference());
    setAppointmentDecision("pending");
    setAppointmentBooking(null);
    setCompanionDecision("pending");
    setJourneyStep("symptoms");
    setHospitalConfirmed(false);
    const card = user?.card;
    if (!card) return;
    // Invalidate any older background symptom translation so it cannot race
    // with this recovery update and restore a symptom the user just cleared.
    ++symptomSaveVersion.current;
    const clearedCard: MedicalCard = {
      ...card,
      symptoms: t("none"),
      korean: { ...(card.korean || {}), symptoms: "없음" },
    };
    setUser((current) => current ? { ...current, card: clearedCard } : current);
    await api.saveCard(clearedCard).catch(() => undefined);
  }, [t, user?.card]);

  const updateCurrentRecord = useCallback(async (patch: Partial<Omit<VisitRecord, "id">>, explicitId?: string | null) => {
    const id = explicitId || currentRecordId;
    if (!id) return;
    await api.updateRecord(id, patch);
    setRecordsVersion((value) => value + 1);
  }, [currentRecordId]);

  const beginVisitRecord = useCallback(async (currentSymptoms: string) => {
    if (currentRecordId) {
      await updateCurrentRecord({ symptoms: currentSymptoms || t("unknown"), status: "searching" });
      return currentRecordId;
    }
    const record = await api.addRecord({
      hospital: t("nearbyHospitals"), department: t("emergencyDept"), symptoms: currentSymptoms || t("unknown"),
      date: new Date().toISOString().slice(0, 10).replaceAll("-", "."), status: "searching",
    });
    setCurrentRecordId(record.id);
    setRecordsCount((value) => value + 1);
    setRecordsVersion((value) => value + 1);
    return record.id;
  }, [currentRecordId, t, updateCurrentRecord]);

  const beginEmergencyRecord = useCallback(async (currentSymptoms: string) => {
    if (currentRecordId) {
      await updateCurrentRecord({ symptoms: currentSymptoms || t("unknown"), hospital: "119", department: t("emergencyDept"), status: "emergency" });
      return currentRecordId;
    }
    const record = await api.addRecord({
      hospital: "119", department: t("emergencyDept"), symptoms: currentSymptoms || t("unknown"),
      date: new Date().toISOString().slice(0, 10).replaceAll("-", "."), status: "emergency",
    });
    setCurrentRecordId(record.id);
    setRecordsCount((value) => value + 1);
    setRecordsVersion((value) => value + 1);
    return record.id;
  }, [currentRecordId, t, updateCurrentRecord]);

  const openHospitals = useCallback(async (nextSymptoms: string) => {
    // An explicit generic hospital request must stay generic. Reusing symptoms
    // from an older visit would fabricate a condition the user did not report.
    const effectiveSymptoms = extractReportableSymptoms(nextSymptoms);
    if (effectiveSymptoms) await captureSymptoms(effectiveSymptoms);
    setSymptoms(effectiveSymptoms);
    setHospitalConfirmed(false);
    if (effectiveSymptoms) advanceJourney("hospital");
    setHospitalsLoading(true);
    setHospitals([]);
    setSelectedHospital(null);
    setAppointmentDecision("pending");
    setAppointmentBooking(null);
    setCompanionDecision("pending");
    setJourneyStep("hospital");
    goTo("hospitals");
    const recordPromise = beginVisitRecord(effectiveSymptoms);
    try {
      const savedCardLocation = user?.card?.latitude && user?.card?.longitude ? {
        lat: user.card.latitude,
        lng: user.card.longitude,
        address: user.card.address || `${user.card.latitude}, ${user.card.longitude}`,
        accuracy: user.card.locationAccuracy,
        verified: true,
      } satisfies LocationState : null;
      // Reuse the current verified fix immediately; the app refreshes it at
      // login and users can explicitly refresh from the hospital screen.
      const current = location.verified ? location : savedCardLocation || await refreshLocation();
      const results = current.verified ? await api.hospitals(current.lat, current.lng, effectiveSymptoms, locale) : [];
      setHospitals(results);
      setSelectedHospital(null);
      await recordPromise;
    } finally { setHospitalsLoading(false); }
  }, [advanceJourney, beginVisitRecord, captureSymptoms, goTo, locale, location, refreshLocation, user?.card]);

  function openJourneyStep(step: VisitJourneyStep) {
    if (visitJourneyStepIndex(step) > visitJourneyStepIndex(journeyStep)) return;
    if (step === "symptoms") {
      goTo("agent");
      return;
    }
    if (step === "hospital") {
      if (hospitals.length) goTo("hospitals");
      else void openHospitals(symptoms);
      return;
    }
    if (step === "appointment" && selectedHospital && hospitalConfirmed) {
      goTo("hospitals");
      return;
    }
    if (step === "companion" && selectedHospital && hospitalConfirmed
      && appointmentDecisionComplete(selectedHospital, appointmentDecision, appointmentBooking)) {
      setCompanionDecision("pending");
      setJourneyStep("companion");
      goTo("agent");
      return;
    }
    if (step === "prepare" && selectedHospital && hospitalConfirmed && companionDecision !== "pending") {
      goTo("visit-flow");
      return;
    }
    if (step === "navigation" && selectedHospital) {
      goTo("navigation");
      return;
    }
    if (step === "translation") {
      goTo("translation");
      return;
    }
    if (step === "complete") goTo("records");
  }

  function navigate(next: View) {
    if (!user) return;
    const allowedWithoutCard: View[] = ["agent", "card", "emergency-confirm", "emergency-calling", "language", "profile", "records"];
    if (!user.card && !allowedWithoutCard.includes(next)) {
      goTo("agent");
      setGateSignal((value) => value + 1);
      return;
    }
    if (next === "hospitals") {
      void openHospitals(extractReportableSymptoms(symptoms || user.card?.symptoms || ""));
      return;
    }
    if (next === "visit-flow") {
      if (!selectedHospital || !hospitalConfirmed) {
        void openHospitals(extractReportableSymptoms(symptoms || user.card?.symptoms || ""));
      } else if (!appointmentDecisionComplete(selectedHospital, appointmentDecision, appointmentBooking)) {
        goTo("hospitals");
      } else if (companionDecision === "pending") {
        goTo("agent");
      } else {
        goTo("visit-flow");
      }
      return;
    }
    if (next === "emergency-confirm") void beginEmergencyRecord(extractReportableSymptoms(symptoms || user.card?.symptoms || ""));
    goTo(next);
  }

  function openLanguage() { goTo("language"); }

  async function match() {
    const matches = await api.getCompanions(filters);
    setPeople(matches);
    advanceJourney("prepare");
    goTo("companions");
  }

  function decideCompanion(decision: Exclude<CompanionDecision, "pending">) {
    setCompanionDecision(decision);
    if (decision === "use") {
      goTo("companions-notice");
      return;
    }
    advanceJourney("prepare");
    goTo("visit-flow");
  }

  function changeAppointmentPreference(preference: AppointmentPreference) {
    setAppointmentPreference(preference);
    setAppointmentDecision("pending");
    setAppointmentBooking(null);
    setCompanionDecision("pending");
    if (selectedHospital && hospitalConfirmed) setJourneyStep("appointment");
  }

  function bookAppointment(slot: HospitalAppointmentSlot) {
    if (!selectedHospital || slot.hospitalId !== selectedHospital.id) return;
    const booking: HospitalAppointmentBooking = {
      id: `APT-${Date.now().toString(36).toUpperCase()}`,
      hospitalId: selectedHospital.id,
      hospitalName: selectedHospital.name,
      slot,
      status: "confirmed",
      createdAt: new Date().toISOString(),
    };
    setAppointmentBooking(booking);
    setAppointmentDecision("booked");
    setCompanionDecision("pending");
    setJourneyStep("companion");
  }

  function skipAppointment() {
    if (!selectedHospital || appointmentPolicyFor(selectedHospital) === "required") return;
    setAppointmentBooking(null);
    setAppointmentDecision("skip");
    setCompanionDecision("pending");
    setJourneyStep("companion");
  }

  function cancelAppointment() {
    setAppointmentBooking(null);
    setAppointmentDecision("pending");
    setCompanionDecision("pending");
    if (selectedHospital && hospitalConfirmed) setJourneyStep("appointment");
  }

  async function applyForCompanion(person = selectedCompanion) {
    setSelectedCompanion(person);
    const created = await api.createOrder({ companion: person, hospital: selectedHospital, status: "requested", durationMinutes: companionDurationMinutes, deposit: Math.round(companionServiceTotal(person.price, companionDurationMinutes) * .1), paymentMethod: "" });
    setOrder(created);
    setOrdersCount((value) => value + 1);
    setOrdersVersion((value) => value + 1);
    void updateCurrentRecord({ status: "companion_requested", details: orderRecordDetails(created) });
    goTo("companion-waiting");
  }

  function selectCompanion(person: Companion) {
    setSelectedCompanion(person);
    setCompanionDurationMinutes(120);
    goTo("companion-detail");
  }

  function acceptOrder() {
    if (!order) return;
    const updated = { ...order, status: "accepted" as const };
    setOrder(updated); goTo("companion-payment");
    setOrdersVersion((value) => value + 1);
    void api.updateOrder(order.id, "accepted");
    void updateCurrentRecord({ details: orderRecordDetails(updated) });
  }

  function payDeposit(method: string) {
    if (!order) return;
    const updated = { ...order, status: "deposit_paid" as const, paymentMethod: method };
    setOrder(updated); goTo("companion-arrived");
    setOrdersVersion((value) => value + 1);
    void api.updateOrder(order.id, "deposit_paid", { paymentMethod: method, amount: order.deposit });
    void updateCurrentRecord({ details: orderRecordDetails(updated) });
  }

  function startCompanionService(stream: MediaStream | null) {
    if (!order) return;
    setRecordingStream(stream);
    if (order.status === "in_service") return;
    const updated = { ...order, status: "in_service" as const, serviceStartedAt: new Date().toISOString() };
    setOrder(updated);
    goTo("companion-service");
    setOrdersVersion((value) => value + 1);
    void api.updateOrder(order.id, "in_service", { serviceStartedAt: updated.serviceStartedAt });
    void updateCurrentRecord({ details: orderRecordDetails(updated) });
  }

  function extendCompanionService() {
    if (!order) return;
    const nextDuration = extendCompanionDuration(order.durationMinutes);
    if (nextDuration === order.durationMinutes) return;
    const updated = { ...order, durationMinutes: nextDuration };
    setOrder(updated);
    setOrdersVersion((value) => value + 1);
    void api.updateOrder(order.id, "in_service", { durationMinutes: updated.durationMinutes });
    void updateCurrentRecord({ details: orderRecordDetails(updated) });
  }

  async function endService(actualDurationMinutes: number) {
    if (!order) return;
    const updated = { ...order, status: "completed" as const, actualDurationMinutes };
    setOrder(updated); goTo("companion-finished");
    setOrdersVersion((value) => value + 1);
    await api.updateOrder(order.id, "completed", { actualDurationMinutes });
    await updateCurrentRecord({ status: "completed", hospital: order.hospital?.name || t("hospital"), symptoms: extractReportableSymptoms(symptoms || user?.card?.symptoms || "") || t("unknown"), details: orderRecordDetails(updated) });
  }

  async function submitCompanionReview(rating: number, review: string) {
    if (order) await api.updateOrder(order.id, "completed", { rating, review });
    setOrdersVersion((value) => value + 1);
    await resetVisitSession("records");
  }

  function payCompanionBalance() {
    if (!order) return;
    const updated = { ...order, balancePaid: true };
    setOrder(updated);
    setOrdersVersion((value) => value + 1);
    void api.updateOrder(order.id, "completed", { balancePaid: true });
    void updateCurrentRecord({ details: orderRecordDetails(updated, "completed", updated.paymentMethod, true) });
  }

  function resumeOrder(nextOrder: CompanionOrder) {
    const safeOrder = {
      ...nextOrder,
      durationMinutes: normalizeCompanionDuration(nextOrder.durationMinutes),
      actualDurationMinutes: nextOrder.actualDurationMinutes === undefined ? undefined : Math.min(MAX_COMPANION_SERVICE_MINUTES, Math.max(60, nextOrder.actualDurationMinutes)),
    };
    setOrder(safeOrder);
    setSelectedCompanion(safeOrder.companion);
    setCompanionDurationMinutes(safeOrder.durationMinutes);
    const destination: View = {
      requested: "companion-waiting",
      accepted: "companion-payment",
      deposit_paid: "companion-arrived",
      arrived: "companion-arrived",
      in_service: "companion-service",
      completed: "companion-finished",
      cancelled: "companions",
    }[safeOrder.status] as View;
    goTo(destination);
  }

  function companionOrderDeleted(id: string) {
    if (order?.id !== id) return;
    recordingStream?.getTracks().forEach((track) => track.stop());
    setRecordingStream(null);
    setOrder(null);
  }

  const resetVisitSession = useCallback(async (destination: "agent" | "records" | "card") => {
    if (user) clearVisitSession(user.id);
    recordingStream?.getTracks().forEach((track) => track.stop());
    setRecordingStream(null);
    setSymptoms("");
    setHospitals([]);
    setHospitalsLoading(false);
    setSelectedHospital(null);
    setHospitalConfirmed(false);
    setAppointmentPreference(defaultAppointmentPreference());
    setAppointmentDecision("pending");
    setAppointmentBooking(null);
    setCompanionDecision("pending");
    setJourneyStep("symptoms");
    setFilters(getDefaultFilters(locale));
    setPeople(api.allCompanions);
    setSelectedCompanion(api.allCompanions[0]);
    setCompanionDurationMinutes(120);
    setOrder(null);
    setCurrentRecordId(null);
    setVisitSessionVersion((value) => value + 1);
    setViewHistory(destination === "agent" ? [] : ["agent"]);
    setVisitedViews(destination === "agent" ? ["agent"] : ["agent", destination]);
    setView(destination);
    await api.clearChatHistory();

    const card = user?.card;
    if (card && (card.symptoms || card.korean?.symptoms)) {
      const clearedCard: MedicalCard = { ...card, symptoms: "", korean: { ...(card.korean || {}), symptoms: "" } };
      setUser((current) => current ? { ...current, card: clearedCard } : current);
      await api.saveCard(clearedCard).catch(() => undefined);
    }
  }, [locale, recordingStream, user?.card, user?.id]);

  async function finishVisitAssistance() {
    await updateCurrentRecord({ status: "completed" });
    advanceJourney("complete");
    goTo("agent", { replace: true });
  }

  function confirmHospitalArrival() {
    if (!selectedHospital || visitJourneyStepIndex(journeyStep) < visitJourneyStepIndex("navigation")) return;
    void updateCurrentRecord({ status: "arrived" });
    advanceJourney("translation");
    goTo("translation");
  }

  const titles: Record<View, string> = {
    agent: "Naru", card: t("createCard"), hospitals: t("nearbyHospitals"), "visit-flow": t("navFlow"), navigation: t("navigationRoute"), translation: t("translationConversation"),
    "companions-notice": t("companionsNotice"), "companions-filter": t("companionConditions"), companions: t("companionsTitle"), "companion-detail": t("companionDetail"), "companion-chat": t("companionChat"),
    "companion-waiting": t("waitingConfirmation"), "companion-payment": t("payDeposit"), "companion-arrived": t("companionArrived"), "companion-service": t("serviceInProgress"), "companion-finished": t("serviceFinished"), "companion-orders": t("companionOrders"),
    "emergency-confirm": t("emergencyCall"), "emergency-calling": t("calling119"), profile: t("profileTitle"), records: t("recordsTitle"), language: t("chooseLanguage"),
  };

  if (checking) return <div className="app-loading"><NaruPose pose={2} /><span>{t("loading")}</span></div>;
  if (!user) return <AuthPage onAuthenticated={(current) => {
    setUser(current);
    setAppointmentPreference(defaultAppointmentPreference());
    setAppointmentDecision("pending");
    setAppointmentBooking(null);
    setCompanionDecision("pending");
    setJourneyStep("symptoms");
    setHospitalConfirmed(false);
    setView("agent");
    setViewHistory([]);
    setVisitedViews(["agent"]);
  }} />;

  const renderView = (target: View): ReactNode => {
    switch (target) {
      case "card": return <MedicalCardPage card={user.card} location={location} onSaved={(card) => { const wasNew = !user.card; setUser({ ...user, card }); if (wasNew) goBack(); }} />;
      case "agent": return <AgentPage
        key={`visit-${visitSessionVersion}`}
        card={user.card}
        journeyStep={journeyStep}
        companionDecision={companionDecision}
        selectedHospital={selectedHospital}
        appointmentPreference={appointmentPreference}
        onCard={() => goTo("card")}
        onSaveCard={async (card) => {
          const saved = await api.saveCard(card);
          setUser((current) => current ? { ...current, card: saved } : current);
          return saved;
        }}
        onEmergency={(value) => { const verifiedSymptoms = extractReportableSymptoms(value); void captureSymptoms(verifiedSymptoms); void beginEmergencyRecord(verifiedSymptoms); setSymptoms(verifiedSymptoms); goTo("emergency-confirm"); }}
        onHospitals={openHospitals}
        onSymptoms={captureSymptoms}
        onSymptomsResolved={clearCurrentSymptoms}
        onFlow={() => openJourneyStep("prepare")}
        onTranslation={() => openJourneyStep("translation")}
        onArrived={confirmHospitalArrival}
        onCompleteVisit={finishVisitAssistance}
        onCompanion={() => goTo("companions-notice")}
        onCompanionDecision={decideCompanion}
        onAppointmentPreference={changeAppointmentPreference}
        onBookAppointment={bookAppointment}
        onSkipAppointment={skipAppointment}
        onOpenAppointments={() => goTo("hospitals")}
        onJourneyStep={openJourneyStep}
        onRestartJourney={() => void resetVisitSession("agent")}
        onRecords={() => goTo("records")}
        gateSignal={gateSignal}
      />;
      case "hospitals": return <HospitalsPage
        location={location}
        hospitals={hospitals}
        loading={hospitalsLoading}
        selected={selectedHospital}
        confirmed={hospitalConfirmed}
        appointmentPreference={appointmentPreference}
        appointmentDecision={appointmentDecision}
        appointmentBooking={appointmentBooking}
        appointmentComplete={Boolean(selectedHospital && appointmentDecisionComplete(selectedHospital, appointmentDecision, appointmentBooking))}
        needsCompanionDecision={Boolean(selectedHospital && appointmentDecisionComplete(selectedHospital, appointmentDecision, appointmentBooking) && companionDecision === "pending")}
        canRoute={visitJourneyStepIndex(journeyStep) >= visitJourneyStepIndex("navigation")}
        onSelect={(hospital) => {
          const changed = selectedHospital?.id !== hospital.id || !hospitalConfirmed;
          setSelectedHospital(hospital);
          setHospitalConfirmed(true);
          if (changed) {
            setAppointmentDecision("pending");
            setAppointmentBooking(null);
            setCompanionDecision("pending");
            setJourneyStep("appointment");
          }
          void updateCurrentRecord({ hospital: hospital.name, status: "hospital_selected" });
        }}
        onAppointmentPreference={changeAppointmentPreference}
        onBookAppointment={bookAppointment}
        onSkipAppointment={skipAppointment}
        onCancelAppointment={cancelAppointment}
        onFlow={() => {
          if (!selectedHospital || !hospitalConfirmed) return;
          if (!appointmentDecisionComplete(selectedHospital, appointmentDecision, appointmentBooking)) return;
          if (companionDecision === "pending") {
            goTo("agent");
            return;
          }
          if (visitJourneyStepIndex(journeyStep) >= visitJourneyStepIndex("prepare")) goTo("visit-flow");
        }}
        onCompanion={() => goTo("companions-notice")}
        onRoute={() => {
          if (!selectedHospital || visitJourneyStepIndex(journeyStep) < visitJourneyStepIndex("navigation")) return;
          void updateCurrentRecord({ hospital: selectedHospital.name, status: "navigating" });
          goTo("navigation");
        }}
        onLocationPick={async (lat, lng) => {
          setHospitalsLoading(true);
          setHospitalConfirmed(false);
          setAppointmentDecision("pending");
          setAppointmentBooking(null);
          setCompanionDecision("pending");
          setJourneyStep("hospital");
          try {
            const address = await api.reverseGeocode(lat, lng);
            const next: LocationState = { lat, lng, address, verified: true };
            setLocation(next);
            const results = await api.hospitals(lat, lng, symptoms, locale);
            setHospitals(results);
            setSelectedHospital(null);
          } finally { setHospitalsLoading(false); }
        }}
        onRefresh={async () => {
          setHospitalsLoading(true);
          setHospitalConfirmed(false);
          setAppointmentDecision("pending");
          setAppointmentBooking(null);
          setCompanionDecision("pending");
          setJourneyStep("hospital");
          try {
            const next = await refreshLocation();
            const results = next.verified ? await api.hospitals(next.lat, next.lng, symptoms, locale) : [];
            setHospitals(results);
            setSelectedHospital(null);
          } finally { setHospitalsLoading(false); }
        }}
      />;
      case "visit-flow": return <VisitFlowPage onStart={() => {
        if (!selectedHospital || !hospitalConfirmed) {
          void openHospitals(symptoms);
          return;
        }
        if (!appointmentDecisionComplete(selectedHospital, appointmentDecision, appointmentBooking)) {
          goTo("hospitals");
          return;
        }
        if (companionDecision === "pending" || visitJourneyStepIndex(journeyStep) < visitJourneyStepIndex("prepare")) {
          goTo("agent");
          return;
        }
        advanceJourney("navigation");
        void updateCurrentRecord({ hospital: selectedHospital.name, status: "navigating" });
        goTo("navigation");
      }} onReturn={() => goBack()} />;
      case "navigation": return selectedHospital ? <NavigationPage location={location} hospital={selectedHospital} onArrived={confirmHospitalArrival} onTranslation={() => goTo("translation")} /> : <Panel><p>{t("noHospitalsFound")}</p></Panel>;
      case "translation": return <TranslationPage userLanguage={user.card?.language || locale} active={view === "translation"} onRecorded={(entry) => { if (currentRecordId) void api.appendRecordTranslation(currentRecordId, entry).then(() => setRecordsVersion((value) => value + 1)); }} onComplete={visitJourneyStepIndex(journeyStep) >= visitJourneyStepIndex("translation") ? () => void finishVisitAssistance() : undefined} />;
      case "companions-notice": return <CompanionNoticePage onContinue={() => goTo("companions-filter")} />;
      case "companions-filter": return <CompanionFilterPage filters={filters} onChange={setFilters} onMatch={() => void match()} />;
      case "companions": return <CompanionListPage people={people} onFilters={() => goTo("companions-filter")} onDetail={selectCompanion} onChoose={selectCompanion} onContinue={() => goTo("visit-flow")} />;
      case "companion-detail": return <CompanionDetailPage person={selectedCompanion} durationMinutes={companionDurationMinutes} onDurationChange={setCompanionDurationMinutes} onChat={() => goTo("companion-chat")} onApply={() => applyForCompanion()} />;
      case "companion-chat": return <CompanionChatPage person={selectedCompanion} hospitalName={selectedHospital?.name || t("hospital")} durationMinutes={companionDurationMinutes} onApply={() => applyForCompanion()} />;
      case "companion-waiting": return order ? <CompanionWaitingPage person={order.companion} onAccepted={() => void acceptOrder()} onMessage={() => goTo("companion-chat")} onCancel={() => { void api.updateOrder(order.id, "cancelled"); setOrder(null); goTo("companions"); }} /> : <Panel />;
      case "companion-payment": return order ? <CompanionPaymentPage order={order} onPay={(method) => void payDeposit(method)} /> : <Panel />;
      case "companion-arrived": return order ? <CompanionArrivedPage order={order} onMet={startCompanionService} onProblem={() => goTo("companion-chat")} /> : <Panel />;
      case "companion-service": return order ? <CompanionServicePage order={order} stream={recordingStream} onExtend={extendCompanionService} onEnd={(minutes) => void endService(minutes)} /> : <Panel />;
      case "companion-finished": return order ? <CompanionFinishedPage order={order} onPayBalance={payCompanionBalance} onReview={(rating, review) => void submitCompanionReview(rating, review)} /> : <Panel />;
      case "companion-orders": return <CompanionOrdersPage version={ordersVersion} onResume={resumeOrder} onDeleted={companionOrderDeleted} onCountChange={setOrdersCount} />;
      case "emergency-confirm": return <EmergencyConfirmPage hasCard={Boolean(user.card)} onCall={() => { void refreshLocation(); goTo("emergency-calling"); }} onDecline={() => user.card ? void openHospitals(extractReportableSymptoms(symptoms || user.card.symptoms || "")) : goTo("card")} />;
      case "emergency-calling": return <EmergencyCallingPage user={user} location={location} symptoms={extractReportableSymptoms(symptoms || user.card?.symptoms || "")} active={view === "emergency-calling"} onTranslation={() => goTo("translation")} onEnd={() => { void (async () => { await updateCurrentRecord({ status: "completed" }); await resetVisitSession(user.card ? "agent" : "card"); })(); }} />;
      case "profile": return <ProfilePage user={user} recordsCount={recordsCount} ordersCount={ordersCount} onCard={() => goTo("card")} onRecords={() => goTo("records")} onOrders={() => goTo("companion-orders")} onLanguage={openLanguage} onLogout={() => { clearVisitSession(user.id); void api.logout(); setUser(null); setAppointmentPreference(defaultAppointmentPreference()); setAppointmentDecision("pending"); setAppointmentBooking(null); setJourneyStep("symptoms"); setCompanionDecision("pending"); setHospitalConfirmed(false); setViewHistory([]); setVisitedViews(["agent"]); }} />;
      case "records": return <RecordsPage version={recordsVersion} onCountChange={setRecordsCount} />;
      case "language": return <Panel className="in-app-language"><h2>{t("chooseLanguage")}</h2><p>{t("languageSubtitle")}</p><LanguageSelector compact onDone={goBack} /></Panel>;
      default: return null;
    }
  };

  return <AppShell view={view} title={titles[view]} user={user} onNavigate={navigate} onLanguage={openLanguage} onBack={goBack} canGoBack={viewHistory.length > 0}>
    <div className="view-preserver">{visitedViews.map((target) => <section key={target} className={`preserved-view ${target === view ? "active" : ""}`} hidden={target !== view} aria-hidden={target !== view}>{renderView(target)}</section>)}</div>
  </AppShell>;
}
