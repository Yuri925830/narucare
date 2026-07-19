import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import L from "leaflet";
import {
  AlertCircle, ArrowLeft, BadgeCheck, CircleUserRound, CreditCard, Globe2, Languages, ListTree,
  MapPin, MessageCircleMore, PhoneCall, ShieldCheck, Sparkles,
} from "lucide-react";
import { localeOptions, useI18n } from "./i18n";
import { api } from "./api";
import type { Hospital, SessionUser, View } from "./types";

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

const nav = [
  { id: "card" as View, key: "navCard" as const, Icon: CreditCard },
  { id: "agent" as View, key: "navNaru" as const, Icon: MessageCircleMore },
  { id: "visit-flow" as View, key: "navFlow" as const, Icon: ListTree },
  { id: "emergency-confirm" as View, key: "navEmergency" as const, Icon: AlertCircle, emergency: true },
  { id: "profile" as View, key: "navProfile" as const, Icon: CircleUserRound },
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
  const isActive = (id: View) => id === view
    || (id === "agent" && ["hospitals", "navigation", "translation", "companions", "companions-notice", "companions-filter", "companion-detail", "companion-chat", "companion-waiting", "companion-payment", "companion-arrived", "companion-service", "companion-finished"].includes(view))
    || (id === "profile" && ["records", "companion-orders"].includes(view));

  return <div className="app-layout">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">N</span><span><strong>NaruCare</strong><small>{t("brandSub")}</small></span></div>
      <nav className="side-nav">
        {nav.map(({ id, key, Icon, emergency }) => <button key={id} className={`${isActive(id) ? "active" : ""} ${emergency ? "emergency-nav" : ""}`} onClick={() => onNavigate(id)}>
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
      {nav.map(({ id, key, Icon, emergency }) => <button key={id} className={`${isActive(id) ? "active" : ""} ${emergency ? "emergency-nav" : ""}`} onClick={() => onNavigate(id)}>
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
      const icon = L.divIcon({ className: "map-marker-wrap", html: `<span class="map-marker hospital-marker${selected?.id === hospital.id ? " selected" : ""}">+</span>`, iconSize: [34, 34], iconAnchor: [17, 17] });
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

interface NaverMapInstance {
  fitBounds: (bounds: unknown, margin?: number | { top: number; right: number; bottom: number; left: number }) => void;
  getCenter: () => NaverLatLng;
  setCenter: (center: unknown) => void;
  setZoom: (zoom: number) => void;
  destroy?: () => void;
}

interface NaverLatLng { lat: () => number; lng: () => number }
interface NaverOverlay { setMap: (map: NaverMapInstance | null) => void }
type NaverEventListener = unknown;

interface NaverMapsNamespace {
  LatLng: new (lat: number, lng: number) => NaverLatLng;
  LatLngBounds: new () => { extend: (point: unknown) => void };
  Map: new (element: HTMLElement, options: Record<string, unknown>) => NaverMapInstance;
  Marker: new (options: Record<string, unknown>) => NaverOverlay;
  Polyline: new (options: Record<string, unknown>) => NaverOverlay;
  Event: {
    addListener: (target: unknown, eventName: string, listener: () => void) => NaverEventListener;
    removeListener: (listener: NaverEventListener) => void;
    trigger: (target: unknown, eventName: string) => void;
  };
}

declare global {
  interface Window { naver?: { maps?: NaverMapsNamespace } }
}

let naverMapsLoader: Promise<NaverMapsNamespace> | null = null;

function loadNaverMaps(clientId: string) {
  const ready = window.naver?.maps;
  if (ready) return Promise.resolve(ready);
  if (naverMapsLoader) return naverMapsLoader;
  naverMapsLoader = new Promise<NaverMapsNamespace>((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    script.dataset.narucareNaverMap = "true";
    script.onload = () => {
      const maps = window.naver?.maps;
      if (maps) resolve(maps);
      else reject(new Error("Naver Maps SDK did not initialize"));
    };
    script.onerror = () => reject(new Error("Naver Maps SDK could not be loaded"));
    document.head.appendChild(script);
  }).catch((error) => {
    naverMapsLoader = null;
    throw error;
  });
  return naverMapsLoader;
}

function useNaverMapsSdk() {
  const [maps, setMaps] = useState<NaverMapsNamespace | null>(window.naver?.maps || null);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    if (maps || useFallback) return;
    let active = true;
    void api.mapsConfig().then((config) => {
      if (!active) return;
      if (!config.dynamicMap || !config.naverClientId) {
        setUseFallback(true);
        return;
      }
      return loadNaverMaps(config.naverClientId).then((loaded) => {
        if (active) setMaps(loaded);
      });
    }).catch(() => { if (active) setUseFallback(true); });
    return () => { active = false; };
  }, [maps, useFallback]);

  return { maps, useFallback };
}

export function InteractiveMap(props: InteractiveMapProps) {
  const { maps, useFallback } = useNaverMapsSdk();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<NaverMapInstance | null>(null);
  const overlaysRef = useRef<NaverOverlay[]>([]);
  const listenersRef = useRef<NaverEventListener[]>([]);
  const onSelectRef = useRef(props.onSelect);
  onSelectRef.current = props.onSelect;

  useEffect(() => {
    if (!maps || !container.current || mapRef.current) return;
    const map = new maps.Map(container.current, {
      center: new maps.LatLng(props.center[0], props.center[1]),
      zoom: 15,
      zoomControl: true,
      scaleControl: true,
      mapDataControl: false,
    });
    mapRef.current = map;
    const resizeTimer = window.setTimeout(() => maps.Event.trigger(map, "resize"), 80);
    return () => {
      window.clearTimeout(resizeTimer);
      listenersRef.current.forEach((listener) => maps.Event.removeListener(listener));
      listenersRef.current = [];
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = [];
      map.destroy?.();
      mapRef.current = null;
    };
  }, [maps]);

  useEffect(() => {
    const map = mapRef.current;
    if (!maps || !map) return;
    listenersRef.current.forEach((listener) => maps.Event.removeListener(listener));
    listenersRef.current = [];
    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    const overlays: NaverOverlay[] = [];
    const bounds = new maps.LatLngBounds();
    const origin = new maps.LatLng(props.center[0], props.center[1]);
    bounds.extend(origin);
    overlays.push(new maps.Marker({ map, position: origin, title: "Current location" }));
    props.hospitals?.forEach((hospital) => {
      const point = new maps.LatLng(hospital.lat, hospital.lng);
      bounds.extend(point);
      const marker = new maps.Marker({
        map,
        position: point,
        title: hospital.name,
        zIndex: props.selected?.id === hospital.id ? 200 : 100,
      });
      overlays.push(marker);
      listenersRef.current.push(maps.Event.addListener(marker, "click", () => onSelectRef.current?.(hospital)));
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
    maps.Event.trigger(map, "resize");
    if ((props.hospitals?.length || 0) + (props.route?.length || 0) > 0) map.fitBounds(bounds, { top: 64, right: 38, bottom: 38, left: 38 });
    else { map.setCenter(origin); map.setZoom(15); }
  }, [maps, props.center[0], props.center[1], props.hospitals, props.selected?.id, props.route]);

  if (useFallback) return <LeafletInteractiveMap {...props} />;
  return <div ref={container} className={`interactive-map naver-interactive-map ${props.className || ""}`} aria-label="Naver interactive map" />;
}

export function NaverNavigationMap({ center, hospital, route = [], className = "" }: {
  center: [number, number];
  hospital: Hospital;
  route?: [number, number][];
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<NaverMapInstance | null>(null);
  const overlaysRef = useRef<NaverOverlay[]>([]);
  const { maps, useFallback } = useNaverMapsSdk();

  useEffect(() => {
    if (!maps || !container.current || mapRef.current) return;
    const map = new maps.Map(container.current, {
      center: new maps.LatLng(center[0], center[1]),
      zoom: 15,
      zoomControl: true,
      scaleControl: true,
      mapDataControl: false,
    });
    mapRef.current = map;
    const resizeTimer = window.setTimeout(() => {
      maps.Event.trigger(map, "resize");
      map.setCenter(new maps.LatLng(center[0], center[1]));
    }, 80);
    return () => {
      window.clearTimeout(resizeTimer);
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = [];
      map.destroy?.();
      mapRef.current = null;
    };
  }, [maps]);

  useEffect(() => {
    const map = mapRef.current;
    if (!maps || !map) return;
    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    const overlays: NaverOverlay[] = [];
    const bounds = new maps.LatLngBounds();
    const origin = new maps.LatLng(center[0], center[1]);
    const destination = new maps.LatLng(hospital.lat, hospital.lng);
    bounds.extend(origin);
    bounds.extend(destination);
    overlays.push(new maps.Marker({ map, position: origin, title: "Current location" }));
    overlays.push(new maps.Marker({ map, position: destination, title: hospital.name }));
    if (route.length > 1) {
      const path = route.map(([lat, lng]) => {
        const point = new maps.LatLng(lat, lng);
        bounds.extend(point);
        return point;
      });
      overlays.push(new maps.Polyline({ map, path, strokeColor: "#785a4d", strokeWeight: 7, strokeOpacity: 0.92 }));
    }
    overlaysRef.current = overlays;
    maps.Event.trigger(map, "resize");
    map.fitBounds(bounds, { top: 72, right: 38, bottom: 38, left: 38 });
  }, [maps, center[0], center[1], hospital.id, hospital.lat, hospital.lng, hospital.name, route]);

  if (useFallback) return <LeafletInteractiveMap center={center} hospitals={[hospital]} selected={hospital} route={route} className={className} />;
  return <div ref={container} className={`interactive-map naver-navigation-map ${className}`} aria-label="Naver interactive map" />;
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
  const { maps, useFallback } = useNaverMapsSdk();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<NaverMapInstance | null>(null);
  const listenerRef = useRef<NaverEventListener | null>(null);
  const onPickRef = useRef(onPick);
  const disabledRef = useRef(disabled);
  const programmaticTarget = useRef<[number, number] | null>(null);
  const gestureVersion = useRef(0);
  const handledGestureVersion = useRef(0);
  onPickRef.current = onPick;
  disabledRef.current = disabled;

  useEffect(() => {
    if (!maps || !container.current || mapRef.current) return;
    const map = new maps.Map(container.current, {
      center: new maps.LatLng(center[0], center[1]),
      zoom: 19,
      minZoom: 7,
      maxZoom: 21,
      zoomControl: true,
      scaleControl: true,
      mapDataControl: false,
    });
    mapRef.current = map;
    const mapElement = container.current;
    const markUserGesture = () => { gestureVersion.current += 1; };
    mapElement.addEventListener("pointerdown", markUserGesture, true);
    mapElement.addEventListener("touchstart", markUserGesture, true);
    mapElement.addEventListener("wheel", markUserGesture, { capture: true, passive: true });
    listenerRef.current = maps.Event.addListener(map, "idle", () => {
      const point = map.getCenter();
      const lat = point.lat();
      const lng = point.lng();
      const target = programmaticTarget.current;
      if (target && Math.abs(target[0] - lat) < 0.0000005 && Math.abs(target[1] - lng) < 0.0000005) {
        programmaticTarget.current = null;
        return;
      }
      programmaticTarget.current = null;
      if (gestureVersion.current === handledGestureVersion.current || disabledRef.current) return;
      handledGestureVersion.current = gestureVersion.current;
      onPickRef.current(lat, lng);
    });
    const resizeTimer = window.setTimeout(() => maps.Event.trigger(map, "resize"), 80);
    return () => {
      window.clearTimeout(resizeTimer);
      mapElement.removeEventListener("pointerdown", markUserGesture, true);
      mapElement.removeEventListener("touchstart", markUserGesture, true);
      mapElement.removeEventListener("wheel", markUserGesture, true);
      if (listenerRef.current) maps.Event.removeListener(listenerRef.current);
      listenerRef.current = null;
      map.destroy?.();
      mapRef.current = null;
    };
  }, [maps]);

  useEffect(() => {
    const map = mapRef.current;
    if (!maps || !map) return;
    const current = map.getCenter();
    if (Math.abs(current.lat() - center[0]) < 0.0000005 && Math.abs(current.lng() - center[1]) < 0.0000005) return;
    programmaticTarget.current = center;
    map.setCenter(new maps.LatLng(center[0], center[1]));
  }, [maps, center[0], center[1]]);

  useEffect(() => {
    const element = container.current;
    if (!maps || !element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const map = mapRef.current;
      if (!map) return;
      maps.Event.trigger(map, "resize");
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [maps]);

  if (useFallback) return <LeafletLocationPickerMap center={center} accuracy={accuracy} disabled={disabled} onPick={onPick} className={className} />;
  return <div className={`location-picker naver-location-picker ${disabled ? "is-disabled" : ""} ${className}`}>
    <div ref={container} className="interactive-map location-picker-map" aria-label="Naver location picker map" />
    <span className="location-picker-crosshair" aria-hidden="true" />
  </div>;
}

export function EmptyState({ icon = <Languages />, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return <div className="empty-state">{icon}<strong>{title}</strong>{children && <p>{children}</p>}</div>;
}

export function formatWon(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}
