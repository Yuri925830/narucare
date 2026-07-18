import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import L from "leaflet";
import {
  AlertCircle, ArrowLeft, BadgeCheck, CircleUserRound, CreditCard, Globe2, Languages, ListTree,
  MapPin, MessageCircleMore, PhoneCall, ShieldCheck, Sparkles,
} from "lucide-react";
import { localeOptions, useI18n } from "./i18n";
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

export function InteractiveMap({ center, hospitals = [], selected, route = [], onSelect, className = "" }: InteractiveMapProps) {
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

export function EmptyState({ icon = <Languages />, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return <div className="empty-state">{icon}<strong>{title}</strong>{children && <p>{children}</p>}</div>;
}

export function formatWon(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}
