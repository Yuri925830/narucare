import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, ArrowRight, CalendarCheck2, CalendarOff, CarFront, Check, Clock3, Copy, Languages, LocateFixed, Map, MapPin, Mic, Navigation, Send, ShieldCheck, Square, Stethoscope, Volume2 } from "lucide-react";
import { api } from "../api";
import { Button, InfoBanner, InteractiveMap, NaverNavigationMap, NaruPose, Panel, StatusPill } from "../components";
import { evaluateOpeningHours, formatOpeningSchedule, formatRestDays } from "../hospitalHours";
import { localeOptions, useI18n } from "../i18n";
import { assessMedicalIntent, extractReportableSymptoms, isAffirmativeResponse, isNaruCapabilityQuestion, isNaruIdentityQuestion, isNegativeResponse, isSymptomsResolvedStatement } from "../triage";
import type { ChatHistoryEntry, Hospital, LocationState, MedicalCard, MedicalEvidenceSource, TranslationRecordEntry } from "../types";

interface Message { id: string; role: "naru" | "user" | "status"; text: string; detail?: string; sources?: MedicalEvidenceSource[] }

function InlineMessageText({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith("**") && part.endsWith("**")
    ? <strong key={`${index}-${part}`}>{part.slice(2, -2)}</strong>
    : part)}</>;
}

function WelcomeMessage({ text }: { text: string }) {
  const blocks = text.trim().split(/\n\s*\n/);
  return <div className="welcome-message" dir="auto">
    {blocks.map((block, index) => {
      const key = `${index}-${block.slice(0, 18)}`;
      if (block === "---") return <hr key={key} />;
      if (block.startsWith("### ")) return <h3 key={key}><InlineMessageText text={block.slice(4)} /></h3>;
      if (block.startsWith("## ")) return <h2 key={key}><InlineMessageText text={block.slice(3)} /></h2>;
      return <p key={key}><InlineMessageText text={block} /></p>;
    })}
  </div>;
}

export function AgentPage({ card, onCard, onEmergency, onHospitals, onSymptoms, onSymptomsResolved, onCompanion, onFlow, onTranslation, gateSignal }: {
  card: MedicalCard | null;
  onCard: () => void;
  onEmergency: (symptoms: string) => void;
  onHospitals: (symptoms: string) => void | Promise<void>;
  onSymptoms?: (symptoms: string) => void | Promise<void>;
  onSymptomsResolved?: () => void | Promise<void>;
  onCompanion: () => void;
  onFlow?: () => void;
  onTranslation?: () => void;
  gateSignal?: number;
}) {
  const { locale, t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([{ id: "welcome", role: "naru", text: t("universalGreeting") }]);
  const [input, setInput] = useState("");
  const [gate, setGate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingHospitalSymptoms, setPendingHospitalSymptoms] = useState<string | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages((current) => current.length === 1 ? [{ id: "welcome", role: "naru", text: t("universalGreeting") }] : current);
  }, [locale, t]);

  useEffect(() => {
    let cancelled = false;
    void api.chatHistory().then((history) => {
      if (cancelled || !history.length) return;
      setMessages((current) => current.length === 1 && current[0]?.id === "welcome" ? [
        current[0],
        ...history.map<Message>((entry) => ({ id: crypto.randomUUID(), role: entry.role === "user" ? "user" : "naru", text: entry.content })),
      ] : current);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { if (!card && gateSignal) setGate(true); }, [card, gateSignal]);
  useEffect(() => { if (card) setGate(false); }, [card]);
  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;
    if (messages.length === 1 && messages[0]?.id === "welcome") {
      container.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text = input) => {
    const clean = text.trim();
    if (!clean || busy) return;
    setInput("");
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: clean }]);
    const cardIntent = /(就诊卡|診療カード|medical card|진료카드|create.*card|建卡)/i.test(clean);
    if (!card && cardIntent) { onCard(); return; }
    if (!card) {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: t("cardRequired") }]);
      setGate(true);
      return;
    }
    if (isNaruIdentityQuestion(clean)) {
      const reply = `💙 ${t("naruIdentityAnswer")} 😊`;
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: reply }]);
      void api.rememberChat(clean, reply, "general");
      return;
    }
    if (isNaruCapabilityQuestion(clean)) {
      const reply = `😊 ${t("naruCapabilitiesAnswer")} 💙`;
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: reply }]);
      void api.rememberChat(clean, reply, "general");
      return;
    }
    if (isSymptomsResolvedStatement(clean)) {
      setPendingHospitalSymptoms(null);
      await onSymptomsResolved?.();
      const reply = `🌿 ${t("symptomsResolvedReply")} 💙`;
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: reply }]);
      void api.rememberChat(clean, reply, "recovery");
      return;
    }
    if (pendingHospitalSymptoms !== null && isAffirmativeResponse(clean)) {
      const confirmedSymptoms = pendingHospitalSymptoms;
      setPendingHospitalSymptoms(null);
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "status", text: t("nearbyHospitals"), detail: confirmedSymptoms || t("nearbyAccepting") }]);
      setBusy(true);
      try { await onHospitals(confirmedSymptoms); }
      finally { setBusy(false); }
      return;
    }
    if (pendingHospitalSymptoms !== null && isNegativeResponse(clean)) {
      setPendingHospitalSymptoms(null);
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: `🌿 ${t("hospitalOfferDeclined")}` }]);
      return;
    }
    const history: ChatHistoryEntry[] = messages
      .filter((message) => message.role !== "status" && message.id !== "welcome")
      .map((message) => ({ role: message.role === "user" ? "user" : "assistant", content: message.text }));
    const previousUserMessages = history.filter((message) => message.role === "user").map((message) => message.content);
    const localTriage = assessMedicalIntent(clean, previousUserMessages, true);
    const reportedSymptoms = extractReportableSymptoms(localTriage.symptoms || "");
    const effectiveEmergencySymptoms = reportedSymptoms || extractReportableSymptoms(card.symptoms || "") || extractReportableSymptoms(clean);
    if (localTriage.intent === "emergency") {
      if (localTriage.symptoms) await onSymptoms?.(localTriage.symptoms);
      setPendingHospitalSymptoms(null);
      onEmergency(effectiveEmergencySymptoms);
      return;
    }
    if (localTriage.intent === "card") { onCard(); return; }
    if (localTriage.intent === "flow") { onFlow?.(); return; }
    if (localTriage.intent === "translation") { onTranslation?.(); return; }
    if (localTriage.intent === "companion") { onCompanion(); return; }
    if (localTriage.intent === "hospital" && localTriage.reason === "hospital_request") {
      if (localTriage.symptoms) await onSymptoms?.(localTriage.symptoms);
      setPendingHospitalSymptoms(null);
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "status", text: t("nearbyHospitals"), detail: reportedSymptoms || t("nearbyAccepting") }]);
      setBusy(true);
      try { await onHospitals(reportedSymptoms); }
      finally { setBusy(false); }
      return;
    }
    setBusy(true);
    try {
      const response = await api.chat(clean, locale, true, history);
      const responseSymptoms = extractReportableSymptoms(response.symptoms || reportedSymptoms);
      if ((response.intent === "hospital" || response.intent === "emergency") && responseSymptoms) await onSymptoms?.(responseSymptoms);
      if (response.intent === "recovery" || response.symptomStatus === "resolved") {
        setPendingHospitalSymptoms(null);
        await onSymptomsResolved?.();
        const reply = response.reply || `🌿 ${t("symptomsResolvedReply")} 💙`;
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: reply }]);
        return;
      }
      if (response.intent === "emergency") {
        setPendingHospitalSymptoms(null);
        return onEmergency(responseSymptoms || extractReportableSymptoms(card.symptoms || "") || extractReportableSymptoms(clean));
      }
      if (response.intent === "hospital") {
        setPendingHospitalSymptoms(responseSymptoms);
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: `🩺 ${t("hospitalConsentPrompt")} 🏥` }]);
        return;
      }
      if (response.intent === "card") return onCard();
      if (response.intent === "flow") return onFlow?.();
      if (response.intent === "translation") return onTranslation?.();
      if (response.intent === "companion") return onCompanion();
      const fallback = response.intent === "education" || localTriage.intent === "education" ? `🩺 ${t("medicalEducationFallback")} 🌿` : `💙 ${t("naruConversationFallback")} 😊`;
      const reply = response.reply || fallback;
      const safeReply = response.intent === "education" && response.reply ? `${reply}\n\n${t("medicalEducationBoundary")}` : reply;
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "naru", text: safeReply, sources: response.sources }]);
    } finally {
      setBusy(false);
    }
  };

  return <div className="agent-grid">
    <Panel className="chat-panel">
      <div className="agent-online"><NaruPose pose={2} className="chat-naru-pose" /><strong>Naru<small>{t("brandSub")}</small></strong><StatusPill><ShieldCheck size={14} />{t("privateConversation")}</StatusPill></div>
      <div className="messages" ref={messagesRef}>
        {messages.map((message) => message.role === "status" ? <InfoBanner key={message.id} tone="mint" title={message.text}>{message.detail || t("nearbyAccepting")}</InfoBanner> : <div key={message.id} className={`message message-${message.role}`}>
          {message.role === "naru" && <div className="message-author"><NaruPose pose={2} className="chat-naru-pose" /><strong>Naru<small>{t("brandSub")}</small></strong></div>}
          {message.id === "welcome" ? <WelcomeMessage text={message.text} /> : <p dir="auto">{message.text}</p>}
          {message.sources?.length ? <div className="message-sources">{message.sources.map((source, index) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><span>[{index + 1}]</span>{source.title}{source.year ? ` · ${source.year}` : ""}</a>)}</div> : null}
        </div>)}
        {busy && <div className="typing"><i /><i /><i /></div>}
      </div>
      {!card && <div className="prompt-suggestions"><span>{t("quickServices")}</span><button onClick={() => send(t("promptUnwell"))}>{t("promptUnwell")}</button><button onClick={onCard}>{t("promptCard")}</button><button onClick={() => send(t("promptCompanion"))}>{t("promptCompanion")}</button></div>}
      <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}><input dir="auto" value={input} onChange={(event) => setInput(event.target.value)} placeholder={t("inputPlaceholder")} /><button aria-label={t("sendMessage")}><ArrowRight /></button></form>
    </Panel>
    <Panel className="agent-status">
      <h3>{t("currentStatus")}</h3>
      <div className={`card-status ${card ? "ready" : "missing"}`}><Stethoscope size={22} /><div><span>{t("navCard")}</span><strong>{card ? t("cardCreated", { name: card.name }) : t("cardNotCreated")}</strong><small>{card ? `${t("userLanguage")} + 한국어` : t("emergencyOnly")}</small></div></div>
      <h3>{t("quickServices")}</h3>
      {[{ label: t("findHospital"), action: () => card ? onHospitals("") : setGate(true) }, { label: t("viewVisitFlow"), action: () => card ? onFlow?.() : setGate(true) }, { label: t("translation"), action: () => card ? onTranslation?.() : setGate(true) }, { label: t("companion"), action: () => card ? onCompanion() : setGate(true) }].map((item) => <button key={item.label} className="quick-link" onClick={item.action}>{item.label}<span>{card ? "→" : t("locked")}</span></button>)}
      <div className="agent-naru-card"><NaruPose pose={6} className="agent-side-naru" /></div>
    </Panel>
    {gate && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="gate-modal"><NaruPose pose={6} className="gate-naru-pose" /><h2>{t("cardMissingShort")}</h2><p>{t("cardRequired")}</p><div><Button onClick={() => { setGate(false); onCard(); }}>{t("createCardNow")}</Button><Button variant="danger" onClick={() => { setGate(false); onEmergency(t("unknown")); }}>{t("urgentCall119")}</Button></div><button className="modal-close" onClick={() => setGate(false)}>×</button><small>{t("cardGateHint")}</small></div></div>}
  </div>;
}

export function HospitalsPage({ location, hospitals, loading, selected, onSelect, onFlow, onCompanion, onRoute, onRefresh }: {
  location: LocationState;
  hospitals: Hospital[];
  loading: boolean;
  selected: Hospital | null;
  onSelect: (hospital: Hospital) => void;
  onFlow: () => void;
  onCompanion: () => void;
  onRoute: () => void;
  onRefresh: () => void;
}) {
  const { locale, t } = useI18n();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return <Panel className="hospital-panel">
    <InfoBanner title={t("analysisResult")} action={<NaruPose pose={5} className="hospital-banner-naru" />}><strong>{t("hospitalNotice")}</strong></InfoBanner>
    <div className="hospital-layout">
      <div className="map-card"><div className="map-location"><MapPin size={17} />{t("currentLocation")} · {location.address}</div><InteractiveMap center={[location.lat, location.lng]} hospitals={hospitals} selected={selected} onSelect={onSelect} /></div>
      <div className="hospital-list"><div className="section-heading"><h3>{t("nearbyAccepting")}</h3><button onClick={onRefresh}><LocateFixed size={16} />{t("refreshLocation")}</button></div><div className="hospital-scroll">
        {loading ? <div className="empty-hospitals"><LocateFixed /><strong>{t("locating")}</strong><p>{t("loading")}</p></div> : !hospitals.length && <div className="empty-hospitals"><AlertTriangle /><strong>{t("noHospitalsFound")}</strong><p>{t("hospitalSearchFailed")}</p></div>}
        {hospitals.map((hospital) => {
          const schedule = evaluateOpeningHours(hospital.openingHours, now);
          const isOpen = typeof hospital.openNow === "boolean" ? hospital.openNow : schedule.isOpen;
          const restDays = formatRestDays(schedule.restDayIndexes, locale);
          const openingSchedule = formatOpeningSchedule(hospital.openingHours, locale);
          const reservationKey = hospital.reservation === "required" ? "reservationRequired" : hospital.reservation === "recommended" ? "reservationRecommended" : hospital.reservation === "not_required" ? "reservationNotRequired" : "reservationUnverified";
          const statusKey = isOpen === true ? "openNow" : isOpen === false ? "closedNow" : "openStatusUnverified";
          const officialSummary = [hospital.officialInstitutionType, hospital.officialSpecialties?.join(" · "), hospital.officialSpecialistCount ? t("hiraSpecialists", { count: hospital.officialSpecialistCount }) : ""].filter(Boolean).join(" · ");
          return <button className={`hospital-item ${selected?.id === hospital.id ? "selected" : ""}`} key={hospital.id} onClick={() => onSelect(hospital)}>
            <span className="hospital-icon">✚</span><strong className="hospital-main">{hospital.name}<small>{hospital.type || (hospital.emergency ? t("emergencyDept") : t("hospital"))}</small><em className={`open-state ${isOpen === true ? "is-open" : isOpen === false ? "is-closed" : "is-unknown"}`}>{t(statusKey)}</em>
              <span className="hospital-facts"><span><Clock3 /> <b>{t("openingHoursLabel")}</b>{openingSchedule || t("hoursUnverified")}</span><span><CalendarOff /><b>{t("restDaysLabel")}</b>{restDays === "" ? t("noFixedRestDay") : restDays || t("restDaysUnverified")}</span><span><CalendarCheck2 /><b>{t("reservationLabel")}</b>{t(reservationKey)}{hospital.reservation === "unknown" && hospital.phone ? ` · ${hospital.phone}` : ""}</span>{officialSummary && <span className="hira-fact"><Stethoscope /><b>{t("hiraOfficialLabel")}</b>{officialSummary}</span>}</span>
              <small className="hospital-source" title={hospital.sourceUrl}>{t("hospitalDataSource", { source: hospital.dataSource || "OpenStreetMap" })}{hospital.lastVerified ? ` · ${t("verifiedDate", { date: hospital.lastVerified })}` : ""}</small>
            </strong><b className="hospital-distance">{hospital.distance < 1000 ? `${Math.round(hospital.distance)}m` : `${(hospital.distance / 1000).toFixed(1)}km`}</b>
          </button>;
        })}</div>
      </div>
    </div>
    <div className="hospital-actions"><Button onClick={onFlow}>{t("navFlow")}</Button><Button variant="secondary" onClick={onCompanion}>{t("companion")}</Button><Button variant="mint" onClick={onRoute} disabled={!selected}><Navigation size={18} />{t("route")}</Button>{selected?.sourceUrl && <a className="button button-ghost" href={selected.sourceUrl} target="_blank" rel="noreferrer">{t("hospitalDataSource", { source: selected.dataSource || "OpenStreetMap" })}</a>}</div>
  </Panel>;
}

export function VisitFlowPage({ onStart, onReturn }: { onStart: () => void; onReturn: () => void }) {
  const { t } = useI18n();
  const prep = [[t("idPassport"), t("idPassportDesc")], [t("insuranceInfo"), t("insuranceInfoDesc")], [t("medicationItem"), t("medicationDesc")], [t("previousResults"), t("previousResultsDesc")]];
  const steps = [[t("stepRegister"), t("stepRegisterDesc")], [t("stepForm"), t("stepFormDesc")], [t("stepWait"), t("stepWaitDesc")], [t("stepRoom"), t("stepRoomDesc")], [t("stepPay"), t("stepPayDesc")]];
  return <Panel className="flow-panel">
    <InfoBanner title={t("visitPrepare")} action={<div className="banner-character"><span className="soft-chip">{t("confirmBefore")}</span><NaruPose pose={10} className="flow-banner-naru" /></div>}>{t("prepareSubtitle")}</InfoBanner>
    <div className="prepare-grid">{prep.map(([title, desc]) => <div key={title}><span><Check size={16} /></span><strong>{title}<small>{desc}</small></strong></div>)}</div>
    <h2>{t("afterArrival")}</h2>
    <div className="flow-steps">{steps.map(([title, desc], index) => <div key={title}><span>{String(index + 1).padStart(2, "0")}</span><strong>{title}<small>{desc}</small></strong>{index < steps.length - 1 && <ArrowRight />}</div>)}</div>
    <InfoBanner title={t("flowReminder")} tone="mint" />
    <div className="flow-choice-actions"><Button variant="secondary" onClick={onReturn}>{t("returnHospitals")}</Button><Button onClick={onStart}><Navigation size={18} />{t("startNavigation")}</Button></div>
  </Panel>;
}

type TravelMode = "walking" | "transit" | "driving";

export function NavigationPage({ location, hospital, onArrived, onTranslation }: { location: LocationState; hospital: Hospital; onArrived: () => void; onTranslation: () => void }) {
  const { locale, t } = useI18n();
  const [mode, setMode] = useState<TravelMode>("walking");
  const [route, setRoute] = useState<[number, number][]>([]);
  const [routeAvailable, setRouteAvailable] = useState(false);
  const [distance, setDistance] = useState(hospital.distance);
  const [duration, setDuration] = useState(Math.max(4, Math.round(hospital.distance / 75)));
  const [addressCopied, setAddressCopied] = useState(false);
  const origin = useMemo<[number, number]>(() => [location.lat, location.lng], [location.lat, location.lng]);
  const destination = useMemo<[number, number]>(() => [hospital.lat, hospital.lng], [hospital.lat, hospital.lng]);
  const destinationAddress = hospital.address?.trim() || `${hospital.lat.toFixed(6)}, ${hospital.lng.toFixed(6)}`;

  useEffect(() => {
    if (!addressCopied) return;
    const timer = window.setTimeout(() => setAddressCopied(false), 2_400);
    return () => window.clearTimeout(timer);
  }, [addressCopied]);

  useEffect(() => {
    if (mode === "transit") { setRoute([]); setRouteAvailable(false); return; }
    let active = true;
    setRouteAvailable(false);
    void api.route(origin, destination, mode).then((result) => {
      if (!active) return;
      setRoute(result.coordinates);
      setRouteAvailable(result.available);
      if (result.distance) setDistance(result.distance);
      if (result.duration) setDuration(Math.max(1, Math.round(result.duration / 60)));
    });
    return () => { active = false; };
  }, [origin[0], origin[1], destination[0], destination[1], mode]);

  const googleUrl = (travelMode: TravelMode) => {
    const params = new URLSearchParams({ api: "1", origin: `${location.lat},${location.lng}`, destination: `${hospital.lat},${hospital.lng}`, travelmode: travelMode, dir_action: "navigate" });
    return `https://www.google.com/maps/dir/?${params}`;
  };
  const kakaoUrl = `https://map.kakao.com/link/to/${encodeURIComponent(hospital.name)},${hospital.lat},${hospital.lng}`;
  const kakaoTaxiUrl = "https://service.kakaomobility.com/launch/kakaot/?ref=KM_homepage_a";
  const uberAppParams = new URLSearchParams({
    "pickup[latitude]": String(location.lat),
    "pickup[longitude]": String(location.lng),
    "pickup[nickname]": "Current location",
    "pickup[formatted_address]": location.address || "Current location",
    "dropoff[latitude]": String(hospital.lat),
    "dropoff[longitude]": String(hospital.lng),
    "dropoff[nickname]": hospital.name,
    "dropoff[formatted_address]": hospital.address || hospital.name,
  });
  const uberWebParams = new URLSearchParams({
    pickup: JSON.stringify({ latitude: location.lat, longitude: location.lng, addressLine1: "Current location", addressLine2: location.address || "Current location" }),
    "drop[0]": JSON.stringify({ latitude: hospital.lat, longitude: hospital.lng, addressLine1: hospital.name, addressLine2: hospital.address || hospital.name }),
  });
  const uberWebUrl = `https://m.uber.com/?${uberWebParams}`;
  const openUber = () => {
    const userAgent = navigator.userAgent;
    if (/Android/i.test(userAgent)) {
      window.location.href = `intent://riderequest?${uberAppParams}#Intent;scheme=uber;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.ubercab;S.browser_fallback_url=${encodeURIComponent(uberWebUrl)};end`;
      return;
    }
    if (/iPhone|iPad|iPod/i.test(userAgent)) {
      const openedAt = Date.now();
      window.location.href = `uber://riderequest?${uberAppParams}`;
      window.setTimeout(() => {
        if (document.visibilityState === "visible" && Date.now() - openedAt < 3_000) window.location.href = uberWebUrl;
      }, 1_500);
      return;
    }
    window.open(uberWebUrl, "_blank", "noopener,noreferrer");
  };
  const openNaverMaps = () => {
    const actionPath = mode === "walking" ? "route/walk" : mode === "transit" ? "route/public" : "navigation";
    const params = new URLSearchParams({
      slat: String(location.lat),
      slng: String(location.lng),
      sname: location.address || "Current location",
      dlat: String(hospital.lat),
      dlng: String(hospital.lng),
      dname: hospital.name,
      appname: `${window.location.origin}${window.location.pathname}`,
    });
    const schemeUrl = `nmap://${actionPath}?${params}`;
    const userAgent = navigator.userAgent;
    if (/Android/i.test(userAgent)) {
      window.location.href = `intent://${actionPath}?${params}#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;end`;
      return;
    }
    if (/iPhone|iPad|iPod/i.test(userAgent)) {
      const openedAt = Date.now();
      window.location.href = schemeUrl;
      window.setTimeout(() => {
        if (document.visibilityState === "visible" && Date.now() - openedAt < 3_000) window.location.href = "https://apps.apple.com/app/id311867728";
      }, 1_500);
      return;
    }
    window.open(`https://map.naver.com/p/search/${encodeURIComponent(hospital.name)}`, "_blank", "noopener,noreferrer");
  };
  const copyDestinationAddress = async () => {
    try {
      await navigator.clipboard.writeText(destinationAddress);
    } catch {
      const field = document.createElement("textarea");
      field.value = destinationAddress;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    setAddressCopied(true);
  };
  const modeLabels: Record<TravelMode, string> = { walking: t("walkingMode"), transit: t("transitMode"), driving: t("drivingMode") };
  const canPreview = mode !== "transit" && routeAvailable;

  return <Panel className="navigation-panel">
    <div className="travel-tabs">{(["walking", "transit", "driving"] as const).map((item) => <button className={mode === item ? "active" : ""} key={item} onClick={() => setMode(item)}>{item === "walking" ? "🚶" : item === "transit" ? "🚇" : "🚗"}<span>{modeLabels[item]}</span></button>)}</div>
    <div className="navigation-layout">
      <div className="map-card"><div className="map-location"><MapPin size={17} />{t("currentLocation")} · {location.address}</div><NaverNavigationMap center={origin} hospital={hospital} route={route} /></div>
      <div className="route-info"><NaruPose pose={14} className="route-naru-pose" /><span>{t("destination")}</span><h2>{hospital.name}</h2><div className="destination-address"><MapPin size={18} /><div><span>{t("hospitalAddress")}</span><strong dir="auto">{destinationAddress}</strong></div><Button type="button" variant="ghost" className={addressCopied ? "copied" : ""} onClick={() => void copyDestinationAddress()} aria-live="polite">{addressCopied ? <Check size={16} /> : <Copy size={16} />}{addressCopied ? t("addressCopied") : t("copyAddress")}</Button></div><strong>{canPreview ? t("routeSummary", { mode: modeLabels[mode], minutes: duration, distance: distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}km` }) : t("routePreviewUnavailable")}</strong><hr /><p>{t("estimatedArrival")}<b>{canPreview ? new Date(Date.now() + duration * 60000).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "—"}</b></p><p>{t("routeStatus")}<b>{canPreview ? t("inProgress") : t("externalNavigation")}</b></p>
        <InfoBanner tone="mint" title={t("autoTranslation")}>{t("arrivalTip")}</InfoBanner>
        <div className="taxi-address-tip"><CarFront size={20} /><span><strong>{t("taxiAddressTitle")}</strong><small>{t("taxiAddressTip")}</small></span></div>
        <div className="external-app-group"><h3><Map size={17} />{t("mapNavigationApps")}</h3><div className="external-map-links map-app-links"><Button className="app-link app-link-naver" onClick={openNaverMaps}><Map size={18} />Naver Maps</Button><a className="button app-link app-link-google" href={googleUrl(mode)} target="_blank" rel="noreferrer"><Map size={18} />Google Maps</a><a className="button app-link app-link-kakao-map" href={kakaoUrl} target="_blank" rel="noreferrer"><Map size={18} />Kakao Maps</a></div></div>
        <div className="external-app-group"><h3><CarFront size={17} />{t("taxiApps")}</h3><div className="external-map-links taxi-app-links"><a className="button app-link app-link-kakao-t" href={kakaoTaxiUrl} target="_blank" rel="noreferrer" title={t("taxiAddressTip")}><CarFront size={18} />Kakao T</a><Button className="app-link app-link-uber" type="button" onClick={openUber} title={t("taxiAddressTip")}><CarFront size={18} />Uber</Button></div></div>
        <Button onClick={onArrived}><MapPin size={18} />{t("arrived")}</Button><Button variant="secondary" onClick={onTranslation}>{t("openTranslation")}</Button>
      </div>
    </div>
  </Panel>;
}

interface SpeechRecognitionResultEventLike extends Event { results: { [index: number]: { [index: number]: { transcript: string } } }; }
interface SpeechRecognitionErrorEventLike extends Event { error?: string; }
interface SpeechRecognitionLike { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; abort(): void; onresult: ((event: SpeechRecognitionResultEventLike) => void) | null; onend: (() => void) | null; onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null; }

export function TranslationPage({ userLanguage, active = true, onRecorded, onComplete }: { userLanguage?: string; active?: boolean; onRecorded?: (entry: TranslationRecordEntry) => void; onComplete?: () => void }) {
  const { locale, t } = useI18n();
  const language = userLanguage || locale;
  const languageOption = localeOptions.find((item) => item.code === language) || localeOptions.find((item) => item.code === locale) || localeOptions[0];
  const [speaker, setSpeaker] = useState<"patient" | "staff">("patient");
  const [input, setInput] = useState("");
  const [patientText, setPatientText] = useState(t("samplePatient"));
  const [patientKo, setPatientKo] = useState(t("samplePatientKo"));
  const [staffKo, setStaffKo] = useState(t("sampleStaffKo"));
  const [staffText, setStaffText] = useState(t("sampleStaffUser"));
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [transcribingVoice, setTranscribingVoice] = useState(false);
  const [busy, setBusy] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);

  async function translate(event?: FormEvent) {
    event?.preventDefault();
    if (!input.trim()) return;
    setBusy(true);
    try {
      if (speaker === "patient") {
        const sourceText = input.trim();
        const translatedText = await api.translate(sourceText, language, "ko");
        setPatientText(sourceText); setPatientKo(translatedText);
        onRecorded?.({ speaker, sourceText, translatedText, sourceLanguage: language, targetLanguage: "ko", timestamp: new Date().toISOString() });
      } else {
        const sourceText = input.trim();
        const translatedText = await api.translate(sourceText, "ko", language);
        setStaffKo(sourceText); setStaffText(translatedText);
        onRecorded?.({ speaker, sourceText, translatedText, sourceLanguage: "ko", targetLanguage: language, timestamp: new Date().toISOString() });
      }
      setInput("");
    } catch { setVoiceError(t("errorGeneric")); }
    finally { setBusy(false); }
  }

  function speak(text: string, lang: string) {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = lang; speechSynthesis.speak(utterance);
  }

  async function startRecorderFallback() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceError(t("voiceUnavailable"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => { setVoiceError(t("microphoneDenied")); setListening(false); };
      recorder.onstop = () => {
        const audio = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        voiceStreamRef.current = null;
        recorderRef.current = null;
        setListening(false);
        if (!audio.size) return;
        setTranscribingVoice(true);
        void api.transcribe(audio, language.split("-")[0])
          .then((text) => { if (text) setInput(text); else setVoiceError(t("voiceUnavailable")); })
          .catch(() => setVoiceError(t("voiceUnavailable")))
          .finally(() => setTranscribingVoice(false));
      };
      setListening(true);
      recorder.start();
    } catch { setVoiceError(t("microphoneDenied")); setListening(false); }
  }

  function toggleListening() {
    setVoiceError("");
    if (listening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      return;
    }
    const scope = window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike; SpeechRecognition?: new () => SpeechRecognitionLike };
    const Recognition = scope.SpeechRecognition || scope.webkitSpeechRecognition;
    if (!Recognition) { void startRecorderFallback(); return; }
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = speaker === "patient" ? languageOption.speech : "ko-KR"; recognition.continuous = false; recognition.interimResults = false;
    recognition.onresult = (event) => setInput(event.results[0][0].transcript);
    recognition.onend = () => { recognitionRef.current = null; setListening(false); };
    recognition.onerror = (event) => {
      recognitionRef.current = null;
      setListening(false);
      setVoiceError(event.error === "not-allowed" || event.error === "service-not-allowed" ? t("microphoneDenied") : t("voiceUnavailable"));
    };
    try { setListening(true); recognition.start(); }
    catch { recognitionRef.current = null; setListening(false); void startRecorderFallback(); }
  }

  useEffect(() => () => {
    recognitionRef.current?.abort();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (active) return;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    setListening(false);
    speechSynthesis.cancel();
  }, [active]);

  return <Panel className="translation-panel">
    <div className="translation-direction"><button className={speaker === "patient" ? "active peach" : ""} onClick={() => setSpeaker("patient")}>{t("patientLanguage", { language: languageOption.nativeName })}</button><ArrowRight /><button className={speaker === "staff" ? "active mint" : ""} onClick={() => setSpeaker("staff")}>{t("hospitalLanguage")}</button></div>
    <div className="translation-cards">
      <article className="translation-card peach"><NaruPose pose={15} className="translation-card-naru" /><span>{t("youSaid")}</span><h2 dir="auto">{patientText}</h2><button onClick={() => speak(patientKo, "ko-KR")}><Volume2 size={16} /></button><hr /><small>{t("naruTranslatedKorean")}</small><p lang="ko">{patientKo}</p></article>
      <article className="translation-card mint"><NaruPose pose={16} className="translation-card-naru" /><span>{t("medicalStaff")}</span><h2 lang="ko">{staffKo}</h2><button onClick={() => speak(staffText, languageOption.speech)}><Volume2 size={16} /></button><hr /><small>{t("naruTranslatedUser")}</small><p dir="auto">{staffText}</p></article>
    </div>
    <form className="translation-composer" onSubmit={translate}><textarea dir="auto" value={input} onChange={(event) => setInput(event.target.value)} placeholder={t("translationInput")} /><button type="button" className={`mic-button ${listening ? "listening" : ""}`} onClick={toggleListening} disabled={transcribingVoice}>{listening ? <Square /> : <Mic />}</button><span>{transcribingVoice ? t("transcribingVoice") : listening ? t("listening") : t("tapToSpeak")}</span><Button type="submit" disabled={busy || transcribingVoice || !input.trim()}><Send size={17} />{busy ? t("loading") : t("translateSend")}</Button>{voiceError && <p className="form-error" role="alert">{voiceError}</p>}</form>
    {onComplete && <div className="translation-finish"><Button variant="secondary" onClick={onComplete}>{t("finishVisitAssistance")}</Button></div>}
  </Panel>;
}
