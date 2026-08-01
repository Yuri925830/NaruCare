import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import L from "leaflet";
import {
  AlertCircle, ArrowLeft, BadgeCheck, Check, CircleUserRound, CreditCard, Globe2, Hospital as HospitalIcon, Languages, ListTree,
  LockKeyhole, MapPin, MessageCircleMore, PhoneCall, ShieldCheck, Sparkles, UserRound,
} from "lucide-react";
import { localeOptions, useI18n } from "./i18n";
import { api } from "./api";
import { companionFlowCopy } from "./companionFlow";
import { hospitalAppointmentCopy } from "./hospitalAppointmentCopy";
import type { Hospital, SessionUser, View } from "./types";
import { isVisitJourneyStepUnlocked, visitJourneyStepIndex, visitJourneySteps, type VisitJourneyStep } from "./visitJourney";

/** One of the 21 official Naru poses from the supplied 7 × 3 character sheet. */
export function NaruPose({ pose = 1, className = "" }: { pose?: number; className?: string }) {
  const safePose = Math.max(1, Math.min(21, Math.floor(pose)));
  const filename = `pose-${String(safePose).padStart(2, "0")}.png`;
  return <span className={`naru-pose ${className}`} aria-hidden="true"><img src={`./naru/${filename}`} alt="" /></span>;
}

/** High-resolution transparent standard character supplied as the canonical Naru artwork. */
export function NaruStandard({ className = "" }: { className?: string }) {
  return <span className={`naru-standard ${className}`} aria-hidden="true"><img src="./naru-standard.png" alt="" /></span>;
}

export function Panel({ className = "", children }: { className?: string; children?: ReactNode }) {
  return <section className={`panel ${className}`}>{children}</section>;
}

export function Button({ className = "", variant = "primary", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "mint" | "navy" | "ghost" }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{children}</button>;
}

export function LanguageButton({ onClick }: { onClick: () => void }) {
  const { option } = useI18n();
  return <button className="language-button" onClick={onClick} aria-label="Change language"><Globe2 size={17} /><span>{option.badge} {option.nativeName}</span></button>;
}

export function StatusPill({ children, tone = "mint" }: { children: ReactNode; tone?: "mint" | "peach" | "navy" | "red" }) {
  return <span className={`status-pill status-${tone}`}>{children}</span>;
}

export function VisitJourneyProgress({ current, onStep, compact = false }: {
  current: VisitJourneyStep;
  onStep: (step: VisitJourneyStep) => void;
  compact?: boolean;
}) {
  const { locale, t } = useI18n();
  const companionFlow = companionFlowCopy(locale);
  const appointmentFlow = hospitalAppointmentCopy(locale);
  const currentIndex = visitJourneyStepIndex(current);
  const labels: Record<VisitJourneyStep, string> = {
    symptoms: t("journeySymptoms"),
    hospital: t("journeyHospital"),
    appointment: appointmentFlow.journeyLabel,
    companion: companionFlow.journeyLabel,
    prepare: t("journeyPrepare"),
    navigation: t("journeyNavigation"),
    translation: t("journeyTranslation"),
    complete: t("journeyComplete"),
  };

  return <div className={`visit-journey-progress ${compact ? "compact" : ""}`} aria-label={t("visitJourney")}>
    {visitJourneySteps.map((step, index) => {
      const unlocked = isVisitJourneyStepUnlocked(current, step);
      const done = index < currentIndex || (current === "complete" && step === "complete");
      const active = index === currentIndex && !done;
      return <button
        type="button"
        key={step}
        className={`${done ? "done" : active ? "active" : "locked"}`}
        disabled={!unlocked}
        aria-current={active ? "step" : undefined}
        onClick={() => onStep(step)}
      >
        <span>{done ? <Check size={15} /> : unlocked ? index + 1 : <LockKeyhole size={13} />}</span>
        <strong>{labels[step]}{!compact && <small>{done ? t("journeyDone") : active ? t("journeyCurrent") : t("journeyLocked")}</small>}</strong>
      </button>;
    })}
  </div>;
}

const bottomNav = [
  { id: "card" as View, key: "navCard" as const, Icon: CreditCard },
  { id: "agent" as View, key: "navNaru" as const, Icon: MessageCircleMore },
  { id: "visit-flow" as View, key: "navFlow" as const, Icon: ListTree },
  { id: "emergency-confirm" as View, key: "navEmergency" as const, Icon: AlertCircle, emergency: true },
  { id: "profile" as View, key: "navProfile" as const, Icon: CircleUserRound },
];

const sideNav = [
  bottomNav[0],
  bottomNav[1],
  { id: "hospitals" as View, key: "findHospital" as const, Icon: HospitalIcon, emergency: false },
  bottomNav[2],
  { id: "companions-notice" as View, key: "companion" as const, Icon: UserRound, emergency: false },
  { id: "translation" as View, key: "translation" as const, Icon: Languages, emergency: false },
  bottomNav[3],
  bottomNav[4],
];

interface AppShellProps {
  view: View;
  title: string;
  user: SessionUser;
  onNavigate: (view: View) => void;
  onLanguage: () => void;
  onBack: () => void;
  canGoBack: boolean;
  children: ReactNode;
  hideHeader?: boolean;
}

export function AppShell({ view, title, user, onNavigate, onLanguage, onBack, canGoBack, children, hideHeader }: AppShellProps) {
  const { t } = useI18n();
  const card = user.card;
  const isSideActive = (id: View) => id === view
    || (id === "hospitals" && ["hospitals", "navigation"].includes(view))
    || (id === "companions-notice" && ["companions", "companions-notice", "companions-filter", "companion-detail", "companion-chat", "companion-waiting", "companion-payment", "companion-arrived", "companion-service", "companion-finished"].includes(view))
    || (id === "emergency-confirm" && view === "emergency-calling")
    || (id === "profile" && ["records", "companion-orders"].includes(view));
  const isBottomActive = (id: View) => id === view
    || (id === "agent" && ["hospitals", "navigation", "translation", "companions", "companions-notice", "companions-filter", "companion-detail", "companion-chat", "companion-waiting", "companion-payment", "companion-arrived", "companion-service", "companion-finished"].includes(view))
    || (id === "emergency-confirm" && view === "emergency-calling")
    || (id === "profile" && ["records", "companion-orders"].includes(view));

  return <div className="app-layout">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">N</span><span><strong>NaruCare</strong><small>{t("brandSub")}</small></span></div>
      <nav className="side-nav">
        {sideNav.map(({ id, key, Icon, emergency }) => <button key={id} className={`${isSideActive(id) ? "active" : ""} ${emergency ? "emergency-nav" : ""}`} onClick={() => onNavigate(id)}>
          <Icon size={22} /><span>{t(key)}</span>{emergency && <i />}
        </button>)}
      </nav>
      <button className="user-mini" onClick={() => onNavigate(card ? "profile" : "card")}>
        <span>{card?.name?.slice(0, 2).toUpperCase() || "?"}</span>
        <strong>{card?.name || t("newUser")}<small>{card ? t("cardCreated", { name: card.name }) : t("cardMissingShort")}</small></strong>
      </button>
    </aside>
    <main className="app-main">
      {!hideHeader && <header className="page-header"><div className="page-title-group">{canGoBack && <PageBack onClick={onBack} />}<h1>{title}</h1></div><div className="page-actions"><LanguageButton onClick={onLanguage} /><StatusPill><ShieldCheck size={15} />{t("privacyProtected")}</StatusPill></div></header>}
      <div className="page-content">{children}</div>
    </main>
    <nav className="bottom-nav">
      {bottomNav.map(({ id, key, Icon, emergency }) => <button key={id} className={`${isBottomActive(id) ? "active" : ""} ${emergency ? "emergency-nav" : ""}`} onClick={() => onNavigate(id)}>
        <span><Icon size={21} /></span><small>{t(key)}</small>
      </button>)}
    </nav>
  </div>;
}

export function LanguageSelector({ onDone, compact = false }: { onDone: () => void; compact?: boolean }) {
  const { locale, setLocale, option, t } = useI18n();
  return <div className={`language-selector ${compact ? "compact" : ""}`}>
    {!compact && <div className="language-hero"><div><strong>{t("naruSpeaks")}</strong><h3>中文 · 한국어</h3><h3>English · 日本語</h3></div><div className="language-hero-characters"><NaruPose pose={1} className="language-hero-naru" /><NaruPose pose={3} className="language-hero-accent" /></div></div>}
    <div className="language-list" role="radiogroup" aria-label={t("chooseLanguage")}>
      {localeOptions.map((item) => <button key={item.code} className={locale === item.code ? "selected" : ""} onClick={() => setLocale(item.code)} role="radio" aria-checked={locale === item.code}>
        <span className="locale-badge">{item.badge}</span><strong dir={item.direction || "ltr"}>{item.nativeName}<small>{item.englishName}</small></strong><i>{locale === item.code ? "✓" : ""}</i>
      </button>)}
    </div>
    <Button className="language-continue" onClick={onDone}><Globe2 size={19} />{t("useLanguage", { language: option.nativeName })}</Button>
    <p className="center-hint">{t("afterLoginSwitch")}</p>
  </div>;
}

export function PageBack({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return <button className="page-back" onClick={onClick}><ArrowLeft size={18} />{t("back")}</button>;
}

export function InfoBanner({ title, children, tone = "peach", icon = "sparkles", action }: { title: string; children?: ReactNode; tone?: "peach" | "mint" | "navy" | "red"; icon?: "sparkles" | "shield" | "location"; action?: ReactNode }) {
  const Icon = icon === "shield" ? BadgeCheck : icon === "location" ? MapPin : Sparkles;
  return <div className={`info-banner banner-${tone}`}><Icon size={23} /><div><strong>{title}</strong>{children && <p>{children}</p>}</div>{action && <div className="banner-action">{action}</div>}</div>;
}

interface InteractiveMapProps {
  center: [number, number];
  hospitals?: Hospital[];
  selected?: Hospital | null;
  route?: [number, number][];
  onSelect?: (hospital: Hospital) => void;
  className?: string;
}

function LeafletInteractiveMap({ center, hospitals = [], selected, route = [], onSelect, className = "" }: InteractiveMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const map = L.map(container.current, { zoomControl: true, attributionControl: true }).setView(center, 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 20,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    const invalidateTimer = window.setTimeout(() => { if (mapRef.current === map) map.invalidateSize(); }, 60);
    return () => { window.clearTimeout(invalidateTimer); map.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);

  useEffect(() => {
    const element = container.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const invalidate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => mapRef.current?.invalidateSize({ pan: false }));
    };
    const observer = new ResizeObserver(invalidate);
    observer.observe(element);
    document.addEventListener("visibilitychange", invalidate);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", invalidate);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const bounds: L.LatLngExpression[] = [];
    const userIcon = L.divIcon({ className: "map-marker-wrap", html: '<span class="map-marker user-marker">●</span>', iconSize: [28, 28], iconAnchor: [14, 14] });
    L.marker(center, { icon: userIcon, title: "Current location" }).addTo(layer);
    bounds.push(center);
    hospitals.forEach((hospital) => {
      const isSelected = selected?.id === hospital.id;
      const icon = L.divIcon({ className: "map-marker-wrap", html: `<span class="map-marker hospital-marker${isSelected ? " selected" : ""}">+</span>`, iconSize: [34, 34], iconAnchor: [17, 17] });
      const tooltip = document.createElement("span");
      tooltip.textContent = hospital.name;
      const marker = L.marker([hospital.lat, hospital.lng], { icon, title: hospital.name }).addTo(layer).bindTooltip(tooltip);
      marker.on("click", () => onSelect?.(hospital));
      bounds.push([hospital.lat, hospital.lng]);
    });
    if (route.length > 1) {
      L.polyline(route, { color: "#785a4d", weight: 6, opacity: .92, lineCap: "round" }).addTo(layer);
      route.forEach((point) => bounds.push(point));
    }
    map.invalidateSize({ pan: false });
    if (bounds.length > 1) map.fitBounds(L.latLngBounds(bounds), { padding: [38, 38], maxZoom: 16 });
    else map.setView(center, 15);
  }, [center[0], center[1], hospitals, selected?.id, route, onSelect]);

  return <div ref={container} className={`interactive-map ${className}`} aria-label="Interactive map" />;
}

interface KakaoLatLng {
  getLat: () => number;
  getLng: () => number;
}

interface KakaoLatLngBounds {
  extend: (point: KakaoLatLng) => void;
}

interface KakaoMapInstance {
  addControl: (control: unknown, position: unknown) => void;
  getCenter: () => KakaoLatLng;
  getLevel: () => number;
  relayout: () => void;
  setBounds: (bounds: KakaoLatLngBounds, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number) => void;
  setCenter: (center: KakaoLatLng) => void;
  setLevel: (level: number) => void;
  setMaxLevel: (level: number) => void;
  setMinLevel: (level: number) => void;
}

interface KakaoOverlay {
  setMap: (map: KakaoMapInstance | null) => void;
}

type KakaoEventHandler = () => void;

interface KakaoListener {
  target: unknown;
  eventName: string;
  handler: KakaoEventHandler;
}

interface KakaoDomListener {
  element: HTMLElement;
  handler: EventListener;
}

interface KakaoMapsNamespace {
  load: (callback: () => void) => void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoLatLngBounds;
  Map: new (element: HTMLElement, options: Record<string, unknown>) => KakaoMapInstance;
  Marker: new (options: Record<string, unknown>) => KakaoOverlay;
  CustomOverlay: new (options: Record<string, unknown>) => KakaoOverlay;
  Polyline: new (options: Record<string, unknown>) => KakaoOverlay;
  ZoomControl: new () => unknown;
  ControlPosition: { RIGHT: unknown };
  event: {
    addListener: (target: unknown, eventName: string, handler: KakaoEventHandler) => void;
    removeListener: (target: unknown, eventName: string, handler: KakaoEventHandler) => void;
  };
}

declare global {
  interface Window { kakao?: { maps?: KakaoMapsNamespace } }
}

let kakaoMapsLoader: Promise<KakaoMapsNamespace> | null = null;

function loadKakaoMaps(javaScriptKey: string) {
  const ready = window.kakao?.maps;
  if (ready && typeof ready.Map === "function") return Promise.resolve(ready);
  if (kakaoMapsLoader) return kakaoMapsLoader;
  kakaoMapsLoader = new Promise<KakaoMapsNamespace>((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=${encodeURIComponent(javaScriptKey)}`;
    script.dataset.narucareKakaoMap = "true";
    script.onload = () => {
      const maps = window.kakao?.maps;
      if (!maps) {
        reject(new Error("Kakao Maps SDK did not initialize"));
        return;
      }
      maps.load(() => {
        const loaded = window.kakao?.maps;
        if (loaded && typeof loaded.Map === "function") resolve(loaded);
        else reject(new Error("Kakao Maps SDK did not finish loading"));
      });
    };
    script.onerror = () => reject(new Error("Kakao Maps SDK could not be loaded"));
    document.head.appendChild(script);
  }).catch((error) => {
    kakaoMapsLoader = null;
    throw error;
  });
  return kakaoMapsLoader;
}

function useKakaoMapsSdk() {
  const initialMaps = window.kakao?.maps;
  const [maps, setMaps] = useState<KakaoMapsNamespace | null>(initialMaps && typeof initialMaps.Map === "function" ? initialMaps : null);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    if (maps || useFallback) return;
    let active = true;
    void api.mapsConfig().then((config) => {
      if (!active) return;
      if (!config.dynamicMap || !config.kakaoJavaScriptKey) {
        setUseFallback(true);
        return;
      }
      return loadKakaoMaps(config.kakaoJavaScriptKey).then((loaded) => {
        if (active) setMaps(loaded);
      });
    }).catch(() => { if (active) setUseFallback(true); });
    return () => { active = false; };
  }, [maps, useFallback]);

  return { maps, useFallback };
}

function removeKakaoListeners(maps: KakaoMapsNamespace, listeners: KakaoListener[]) {
  listeners.forEach(({ target, eventName, handler }) => maps.event.removeListener(target, eventName, handler));
}

function removeKakaoDomListeners(listeners: KakaoDomListener[]) {
  listeners.forEach(({ element, handler }) => element.removeEventListener("click", handler));
}

export function InteractiveMap(props: InteractiveMapProps) {
  const { maps, useFallback } = useKakaoMapsSdk();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMapInstance | null>(null);
  const overlaysRef = useRef<KakaoOverlay[]>([]);
  const listenersRef = useRef<KakaoListener[]>([]);
  const domListenersRef = useRef<KakaoDomListener[]>([]);
  const onSelectRef = useRef(props.onSelect);
  onSelectRef.current = props.onSelect;

  useEffect(() => {
    if (!maps || !container.current || mapRef.current) return;
    const mapElement = container.current;
    const map = new maps.Map(mapElement, {
      center: new maps.LatLng(props.center[0], props.center[1]),
      level: 4,
    });
    map.addControl(new maps.ZoomControl(), maps.ControlPosition.RIGHT);
    mapRef.current = map;
    const resizeTimer = window.setTimeout(() => map.relayout(), 80);
    return () => {
      window.clearTimeout(resizeTimer);
      removeKakaoListeners(maps, listenersRef.current);
      listenersRef.current = [];
      removeKakaoDomListeners(domListenersRef.current);
      domListenersRef.current = [];
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = [];
      mapRef.current = null;
      mapElement.replaceChildren();
    };
  }, [maps]);

  useEffect(() => {
    const map = mapRef.current;
    if (!maps || !map) return;
    removeKakaoListeners(maps, listenersRef.current);
    listenersRef.current = [];
    removeKakaoDomListeners(domListenersRef.current);
    domListenersRef.current = [];
    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    const overlays: KakaoOverlay[] = [];
    const bounds = new maps.LatLngBounds();
    const origin = new maps.LatLng(props.center[0], props.center[1]);
    bounds.extend(origin);
    overlays.push(new maps.Marker({ map, position: origin, title: "Current location", zIndex: 300 }));
    props.hospitals?.forEach((hospital) => {
      const point = new maps.LatLng(hospital.lat, hospital.lng);
      bounds.extend(point);
      const isSelected = props.selected?.id === hospital.id;
      const markerButton = document.createElement("button");
      markerButton.type = "button";
      markerButton.className = `map-marker hospital-marker${isSelected ? " selected" : ""}`;
      markerButton.textContent = "+";
      markerButton.title = hospital.name;
      markerButton.dataset.hospitalId = hospital.id;
      markerButton.setAttribute("aria-label", hospital.name);
      markerButton.setAttribute("aria-pressed", String(isSelected));
      const marker = new maps.CustomOverlay({
        map,
        position: point,
        content: markerButton,
        xAnchor: 0.5,
        yAnchor: 0.5,
        clickable: true,
        zIndex: isSelected ? 200 : 100,
      });
      overlays.push(marker);
      const handler: EventListener = () => onSelectRef.current?.(hospital);
      markerButton.addEventListener("click", handler);
      domListenersRef.current.push({ element: markerButton, handler });
    });
    if (props.route && props.route.length > 1) {
      const path = props.route.map(([lat, lng]) => {
        const point = new maps.LatLng(lat, lng);
        bounds.extend(point);
        return point;
      });
      overlays.push(new maps.Polyline({ map, path, strokeColor: "#785a4d", strokeWeight: 7, strokeOpacity: 0.92 }));
    }
    overlaysRef.current = overlays;
    map.relayout();
    if ((props.hospitals?.length || 0) + (props.route?.length || 0) > 0) map.setBounds(bounds, 64, 38, 38, 38);
    else { map.setCenter(origin); map.setLevel(4); }
  }, [maps, props.center[0], props.center[1], props.hospitals, props.selected?.id, props.route]);

  if (useFallback) return <LeafletInteractiveMap {...props} />;
  return <div ref={container} className={`interactive-map kakao-interactive-map ${props.className || ""}`} aria-label="Kakao interactive map" />;
}

export function KakaoNavigationMap({ center, hospital, route = [], className = "" }: {
  center: [number, number];
  hospital: Hospital;
  route?: [number, number][];
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMapInstance | null>(null);
  const overlaysRef = useRef<KakaoOverlay[]>([]);
  const { maps, useFallback } = useKakaoMapsSdk();

  useEffect(() => {
    if (!maps || !container.current || mapRef.current) return;
    const mapElement = container.current;
    const map = new maps.Map(mapElement, {
      center: new maps.LatLng(center[0], center[1]),
      level: 4,
    });
    map.addControl(new maps.ZoomControl(), maps.ControlPosition.RIGHT);
    mapRef.current = map;
    const resizeTimer = window.setTimeout(() => {
      map.relayout();
      map.setCenter(new maps.LatLng(center[0], center[1]));
    }, 80);
    return () => {
      window.clearTimeout(resizeTimer);
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = [];
      mapRef.current = null;
      mapElement.replaceChildren();
    };
  }, [maps]);

  useEffect(() => {
    const map = mapRef.current;
    if (!maps || !map) return;
    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    const overlays: KakaoOverlay[] = [];
    const bounds = new maps.LatLngBounds();
    const origin = new maps.LatLng(center[0], center[1]);
    const destination = new maps.LatLng(hospital.lat, hospital.lng);
    bounds.extend(origin);
    bounds.extend(destination);
    overlays.push(new maps.Marker({ map, position: origin, title: "Current location", zIndex: 200 }));
    overlays.push(new maps.Marker({ map, position: destination, title: hospital.name, zIndex: 100 }));
    if (route.length > 1) {
      const path = route.map(([lat, lng]) => {
        const point = new maps.LatLng(lat, lng);
        bounds.extend(point);
        return point;
      });
      overlays.push(new maps.Polyline({ map, path, strokeColor: "#785a4d", strokeWeight: 7, strokeOpacity: 0.92 }));
    }
    overlaysRef.current = overlays;
    map.relayout();
    map.setBounds(bounds, 72, 38, 38, 38);
  }, [maps, center[0], center[1], hospital.id, hospital.lat, hospital.lng, hospital.name, route]);

  if (useFallback) return <LeafletInteractiveMap center={center} hospitals={[hospital]} selected={hospital} route={route} className={className} />;
  return <div ref={container} className={`interactive-map kakao-navigation-map ${className}`} aria-label="Kakao interactive map" />;
}

function LeafletLocationPickerMap({ center, accuracy, disabled = false, onPick, className = "" }: {
  center: [number, number];
  accuracy?: number;
  disabled?: boolean;
  onPick: (lat: number, lng: number) => void;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyRef = useRef<L.Circle | null>(null);
  const onPickRef = useRef(onPick);
  const disabledRef = useRef(disabled);
  const programmaticMove = useRef(false);
  onPickRef.current = onPick;
  disabledRef.current = disabled;

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const map = L.map(container.current, { zoomControl: true, attributionControl: true, maxZoom: 20 }).setView(center, 19);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 20,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    const icon = L.divIcon({ className: "map-marker-wrap", html: '<span class="map-marker picker-marker">●</span>', iconSize: [34, 34], iconAnchor: [17, 17] });
    markerRef.current = L.marker(center, { icon, interactive: false }).addTo(map);
    accuracyRef.current = L.circle(center, { radius: Math.max(1, accuracy || 1), color: "#785a4d", fillColor: "#e8c9b8", fillOpacity: .18, weight: 1 }).addTo(map);
    const updateFromMap = () => {
      if (programmaticMove.current || disabledRef.current) return;
      const point = map.getCenter();
      markerRef.current?.setLatLng(point);
      accuracyRef.current?.setLatLng(point);
      onPickRef.current(point.lat, point.lng);
    };
    map.on("moveend", updateFromMap);
    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 60);
    mapRef.current = map;
    return () => {
      window.clearTimeout(resizeTimer);
      map.off("moveend", updateFromMap);
      map.remove();
      mapRef.current = null; markerRef.current = null; accuracyRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const next = L.latLng(center);
    markerRef.current?.setLatLng(next);
    accuracyRef.current?.setLatLng(next).setRadius(Math.max(1, accuracy || 1));
    if (map.getCenter().distanceTo(next) <= .25) return;
    programmaticMove.current = true;
    map.setView(next, Math.max(map.getZoom(), 18), { animate: false });
    // A non-animated Leaflet setView emits moveend synchronously. Release the
    // guard immediately so a user drag that starts while GPS is still refining
    // is never mistaken for another programmatic recenter.
    programmaticMove.current = false;
  }, [center[0], center[1], accuracy]);

  useEffect(() => {
    const element = container.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => mapRef.current?.invalidateSize({ pan: false }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div className={`location-picker ${disabled ? "is-disabled" : ""} ${className}`}>
    <div ref={container} className="interactive-map location-picker-map" aria-label="Location picker map" />
    <span className="location-picker-crosshair" aria-hidden="true" />
  </div>;
}

export function LocationPickerMap({ center, accuracy, disabled = false, onPick, className = "" }: {
  center: [number, number];
  accuracy?: number;
  disabled?: boolean;
  onPick: (lat: number, lng: number) => void;
  className?: string;
}) {
  const { maps, useFallback } = useKakaoMapsSdk();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMapInstance | null>(null);
  const listenerRef = useRef<KakaoEventHandler | null>(null);
  const onPickRef = useRef(onPick);
  const disabledRef = useRef(disabled);
  const programmaticTarget = useRef<[number, number] | null>(null);
  const gestureVersion = useRef(0);
  const handledGestureVersion = useRef(0);
  onPickRef.current = onPick;
  disabledRef.current = disabled;

  useEffect(() => {
    if (!maps || !container.current || mapRef.current) return;
    const mapElement = container.current;
    const map = new maps.Map(mapElement, {
      center: new maps.LatLng(center[0], center[1]),
      level: 2,
    });
    map.setMinLevel(1);
    map.setMaxLevel(10);
    map.addControl(new maps.ZoomControl(), maps.ControlPosition.RIGHT);
    mapRef.current = map;
    const markUserGesture = () => { gestureVersion.current += 1; };
    mapElement.addEventListener("pointerdown", markUserGesture, true);
    mapElement.addEventListener("touchstart", markUserGesture, true);
    mapElement.addEventListener("wheel", markUserGesture, { capture: true, passive: true });
    const handleIdle = () => {
      const point = map.getCenter();
      const lat = point.getLat();
      const lng = point.getLng();
      const target = programmaticTarget.current;
      if (target && Math.abs(target[0] - lat) < 0.0000005 && Math.abs(target[1] - lng) < 0.0000005) {
        programmaticTarget.current = null;
        return;
      }
      programmaticTarget.current = null;
      if (gestureVersion.current === handledGestureVersion.current || disabledRef.current) return;
      handledGestureVersion.current = gestureVersion.current;
      onPickRef.current(lat, lng);
    };
    maps.event.addListener(map, "idle", handleIdle);
    listenerRef.current = handleIdle;
    const resizeTimer = window.setTimeout(() => map.relayout(), 80);
    return () => {
      window.clearTimeout(resizeTimer);
      mapElement.removeEventListener("pointerdown", markUserGesture, true);
      mapElement.removeEventListener("touchstart", markUserGesture, true);
      mapElement.removeEventListener("wheel", markUserGesture, true);
      if (listenerRef.current) maps.event.removeListener(map, "idle", listenerRef.current);
      listenerRef.current = null;
      mapRef.current = null;
      mapElement.replaceChildren();
    };
  }, [maps]);

  useEffect(() => {
    const map = mapRef.current;
    if (!maps || !map) return;
    const current = map.getCenter();
    if (Math.abs(current.getLat() - center[0]) < 0.0000005 && Math.abs(current.getLng() - center[1]) < 0.0000005) return;
    programmaticTarget.current = center;
    map.setCenter(new maps.LatLng(center[0], center[1]));
  }, [maps, center[0], center[1]]);

  useEffect(() => {
    const element = container.current;
    if (!maps || !element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const map = mapRef.current;
      if (!map) return;
      const current = map.getCenter();
      map.relayout();
      map.setCenter(current);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [maps]);

  if (useFallback) return <LeafletLocationPickerMap center={center} accuracy={accuracy} disabled={disabled} onPick={onPick} className={className} />;
  return <div className={`location-picker kakao-location-picker ${disabled ? "is-disabled" : ""} ${className}`}>
    <div ref={container} className="interactive-map location-picker-map" aria-label="Kakao location picker map" />
    <span className="location-picker-crosshair" aria-hidden="true" />
  </div>;
}

export function EmptyState({ icon = <Languages />, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return <div className="empty-state">{icon}<strong>{title}</strong>{children && <p>{children}</p>}</div>;
}

export function formatWon(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}
