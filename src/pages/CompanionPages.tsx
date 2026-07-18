import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { BadgeCheck, Check, Clock3, MessageCircleMore, Mic, Phone, ShieldCheck, Star, UserRound, WalletCards } from "lucide-react";
import { api } from "../api";
import { Button, formatWon, InfoBanner, NaruPose, NaruStandard, Panel, StatusPill } from "../components";
import { localeOptions, useI18n } from "../i18n";
import type { Companion, CompanionFilters, CompanionOrder } from "../types";

export function CompanionNoticePage({ onContinue }: { onContinue: () => void }) {
  const { t } = useI18n();
  const [agreed, setAgreed] = useState(false);
  const rules = [[t("companionRule1"), t("companionRule1Desc")], [t("companionRule2"), t("companionRule2Desc")], [t("companionRule3"), t("companionRule3Desc")], [t("companionRule4"), t("companionRule4Desc")]];
  return <Panel className="companion-notice-panel">
    <InfoBanner title={t("beforeCompanion")} action={<><NaruPose pose={9} className="companion-notice-naru" /><NaruPose pose={13} className="companion-notice-accent" /></>}>{t("beforeCompanionDesc")}</InfoBanner>
    <div className="notice-grid">{rules.map(([title, desc], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><strong>{title}<small>{desc}</small></strong></article>)}</div>
    <div className="notice-actions"><label className={`agree-check ${agreed ? "checked" : ""}`}><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /><span><Check /></span>{t("agreeNotice")}</label><Button disabled={!agreed} onClick={onContinue}><UserRound size={18} />{t("findCompanion")}</Button></div>
  </Panel>;
}

export function CompanionFilterPage({ filters, onChange, onMatch }: { filters: CompanionFilters; onChange: (filters: CompanionFilters) => void; onMatch: () => void }) {
  const { t } = useI18n();
  const languageChoices = localeOptions.slice(0, 16);
  const update = (key: keyof CompanionFilters, value: CompanionFilters[keyof CompanionFilters]) => onChange({ ...filters, [key]: value });
  return <div className="filter-layout">
    <Panel className="filter-panel"><h2>{t("tellPreferences")}</h2><p>{t("preciseMatch")}</p>
      <div className="filter-grid">
        <label><span>{t("genderPreference")}</span><select value={filters.gender} onChange={(event) => update("gender", event.target.value)}><option value="any">{t("any")}</option><option value="female">{t("female")}</option><option value="male">{t("male")}</option></select></label>
        <label><span>{t("nationalityPreference")}</span><select value={filters.nationality} onChange={(event) => update("nationality", event.target.value)}><option value="any">{t("any")}</option>{[...new Set(api.allCompanions.map((person) => person.nationality))].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>{t("ageRange")}</span><select value={filters.age} onChange={(event) => update("age", event.target.value)}><option value="any">{t("any")}</option><option value="20-30">20–30</option><option value="25-45">25–45</option><option value="35-55">35–55</option><option value="45-70">45–70</option></select></label>
        <label><span>{t("arrivalTime")}</span><select value={filters.eta} onChange={(event) => update("eta", event.target.value)}><option value="30">30 min</option><option value="60">{t("withinHour")}</option><option value="120">2 h</option></select></label>
        <label className="span-2"><span>{t("spokenLanguages")}</span><div className="language-chips">{languageChoices.map((item) => <button type="button" key={item.code} className={filters.languages.includes(item.code) ? "selected" : ""} onClick={() => update("languages", filters.languages.includes(item.code) ? filters.languages.filter((code) => code !== item.code) : [...filters.languages, item.code])}>{item.badge} {item.nativeName}</button>)}</div></label>
        <label><span>{t("minimumRating")}</span><select value={filters.rating} onChange={(event) => update("rating", event.target.value)}><option value="0">{t("any")}</option><option value="4">{t("fourPlus")}</option><option value="4.7">4.7+</option><option value="4.9">4.9+</option></select></label>
        <label><span>{t("priceRange")}</span><div className="price-inputs"><span>₩</span><input type="number" step="1000" value={filters.minPrice} onChange={(event) => update("minPrice", Number(event.target.value))} /><b>—</b><span>₩</span><input type="number" step="1000" value={filters.maxPrice} onChange={(event) => update("maxPrice", Number(event.target.value))} /></div></label>
      </div>
      <Button onClick={onMatch}><UserRound size={18} />{t("aiMatch")}</Button>
    </Panel>
    <aside className="filter-naru"><NaruStandard className="filter-naru-pose" /><NaruPose pose={12} className="companion-filter-decoration" /><h2>Naru</h2><p>{t("preciseMatch")}</p><div><small>{t("matchesFound", { count: 24 })}</small><strong>24</strong></div></aside>
  </div>;
}

export function CompanionListPage({ people, onFilters, onDetail, onChoose }: { people: Companion[]; onFilters: () => void; onDetail: (person: Companion) => void; onChoose: (person: Companion) => void | Promise<void> }) {
  const { t } = useI18n();
  const [limit, setLimit] = useState(6);
  const [choosingId, setChoosingId] = useState("");
  const [chooseError, setChooseError] = useState("");
  async function choose(person: Companion) {
    if (choosingId) return;
    setChoosingId(person.id); setChooseError("");
    try { await onChoose(person); }
    catch { setChooseError(t("errorGeneric")); setChoosingId(""); }
  }
  return <Panel className="companion-list-panel">
    <InfoBanner title={t("matchedForYou")} action={<div className="match-banner-action"><NaruPose pose={11} className="companion-list-naru" /><Button variant="ghost" onClick={onFilters}>{t("changeFilters")}</Button></div>}>{t("matchingBasis")}</InfoBanner>
    <div className="companion-list">{people.slice(0, limit).map((person) => <article key={person.id}>
      <span className="person-avatar">{person.nativeName.slice(0, 1)}</span><div className="person-main"><h3>{person.name}</h3><div><StatusPill>{person.match || 90}% {t("match")}</StatusPill><em><Star size={14} fill="currentColor" />{person.rating}</em></div><small>{person.languages.map((code) => localeOptions.find((item) => item.code === code)?.nativeName || code).join(" / ")}</small></div>
      <div className="person-price"><strong>₩{formatWon(person.price)} {t("perHour")}</strong><small>{t("arrivesIn", { minutes: person.eta, max: person.eta + 8 })}</small></div>
      <div className="person-actions"><Button variant="ghost" onClick={() => onDetail(person)}>{t("viewDetails")}</Button><Button onClick={() => void choose(person)} disabled={Boolean(choosingId)}>{choosingId === person.id ? t("loading") : t("chooseCompanion")}</Button></div>
    </article>)}</div>
    {chooseError && <p className="form-error" role="alert">{chooseError}</p>}
    <div className="list-footer"><InfoBanner tone="navy" icon="shield" title={t("serviceSafety")}>{t("serviceSafetyDesc")}</InfoBanner>{limit < people.length && <Button onClick={() => setLimit(Math.min(limit + 6, people.length))}>{t("loadMoreMatches")}</Button>}</div>
  </Panel>;
}

export function CompanionDetailPage({ person, onChat, onApply }: { person: Companion; onChat: () => void; onApply: () => void | Promise<void> }) {
  const { locale, t } = useI18n();
  const [experience, setExperience] = useState(person.experience);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");
  useEffect(() => {
    let active = true;
    setExperience(person.experience);
    if (!locale.startsWith("zh")) {
      void api.translate(person.experience, "zh-CN", locale).then((translated) => {
        if (active && translated.trim()) setExperience(translated);
      });
    }
    return () => { active = false; };
  }, [locale, person.experience]);
  async function apply() { if (applying) return; setApplying(true); setApplyError(""); try { await onApply(); } catch { setApplyError(t("errorGeneric")); setApplying(false); } }
  return <Panel className="companion-detail-panel">
    <div className="detail-profile"><NaruPose pose={17} className="companion-detail-naru" /><span className="person-avatar xl">{person.nativeName.slice(0, 1)}</span><h2>{person.name}</h2><p>{person.languages.map((code) => localeOptions.find((item) => item.code === code)?.nativeName || code).join(" · ")} · {t("fluent")}</p><StatusPill>{person.hospitals[0]} {t("hospitalFamiliar")}</StatusPill><div className="detail-stats"><span><strong>{person.rating}</strong><small>{t("ratingLabel")}</small></span><span><strong>{person.match || 96}%</strong><small>{t("onTime")}</small></span><span><strong>{person.reviewCount}+</strong><small>{t("completedOrders")}</small></span></div><div className="detail-buttons"><Button variant="secondary" onClick={onChat}><MessageCircleMore />{t("startChat")}</Button><Button onClick={() => void apply()} disabled={applying}><UserRound />{applying ? t("loading") : t("applyCompanion")}</Button></div>{applyError && <p className="form-error" role="alert">{applyError}</p>}</div>
    <div className="detail-info"><h3>{t("experience")}</h3><p className="detail-copy">{experience}</p><h3>{t("userReview")}</h3><div className="review-card"><strong>“{t("sampleCompanionReview")}”</strong><small>— {t("completedOrders")}</small><em>★★★★★ {person.rating}</em></div><div className="detail-price"><small>{t("servicePrice")}</small><strong>₩{formatWon(person.price)} {t("perHour")}</strong></div><InfoBanner tone="navy" icon="shield" title={t("serviceSafety")}>{t("serviceSafetyDesc")}</InfoBanner></div>
  </Panel>;
}

export function CompanionChatPage({ person, hospitalName, onApply }: { person: Companion; hospitalName: string; onApply: () => void | Promise<void> }) {
  const { t } = useI18n();
  const [messages, setMessages] = useState([t("companionGreeting", { hospital: person.hospitals[0], minutes: person.eta })]);
  const [input, setInput] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");
  function send(event: FormEvent) { event.preventDefault(); if (!input.trim()) return; setMessages([...messages, input]); setInput(""); }
  async function apply() { if (applying) return; setApplying(true); setApplyError(""); try { await onApply(); } catch { setApplyError(t("errorGeneric")); setApplying(false); } }
  return <div className="companion-chat-layout"><Panel className="companion-chat-panel"><div className="chat-person"><span className="person-avatar">{person.nativeName.slice(0, 1)}</span><strong>{person.name}<small>{t("onlineEta", { minutes: person.eta })}</small></strong><StatusPill tone="navy"><ShieldCheck size={14} />{t("safetyRecordingOn")}</StatusPill></div><div className="messages"><div className="message message-naru"><p>{messages[0]}</p></div><div className="message message-user"><p>{t("userAtHospital", { hospital: hospitalName })}</p></div>{messages.slice(1).map((message, i) => <div key={i} className="message message-user"><p>{message}</p></div>)}</div><form className="chat-composer" onSubmit={send}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder={t("sendMessage")} /><button aria-label={t("sendMessage")}>→</button></form></Panel>
    <Panel className="application-card"><h3>{t("application")}</h3><dl><div><dt>{t("hospital")}</dt><dd>{hospitalName}</dd></div><div><dt>{t("startTime")}</dt><dd>{t("todayAt", { time: "16:00" })}</dd></div><div><dt>{t("estimatedDuration")}</dt><dd>{t("hours", { count: 2 })}</dd></div><div><dt>{t("price")}</dt><dd>₩{formatWon(person.price)} {t("perHour")}</dd></div></dl><InfoBanner tone="mint" icon="shield" title={t("serviceSafety")}>{t("recordSavedDesc")}</InfoBanner>{applyError && <p className="form-error" role="alert">{applyError}</p>}<Button onClick={() => void apply()} disabled={applying}>{applying ? t("loading") : t("requestNamed", { name: person.name })}</Button></Panel></div>;
}

export function CompanionWaitingPage({ person, onAccepted, onMessage, onCancel }: { person: Companion; onAccepted: () => void; onMessage: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [seconds, setSeconds] = useState(20 * 60);
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
      return () => clearInterval(timer);
    }, []);
  const display = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    return <Panel className="waiting-panel"><div className="waiting-clock"><NaruStandard className="companion-waiting-naru" /><div>{display}</div><h2>{t("waitingNamed", { name: person.name })}</h2><p>{t("timeoutNoCharge")}</p></div><div className="waiting-info"><article><span className="person-avatar">{person.nativeName.slice(0, 1)}</span><strong>{person.name}<small>{t("todayAt", { time: "16:00" })}</small></strong></article><div className="waiting-contact"><Button variant="secondary" onClick={onMessage}><MessageCircleMore />{t("privateMessage")}</Button>{person.phone && <Button variant="ghost" onClick={() => { window.location.href = `tel:${person.phone}`; }}><Phone />{t("callPhone")}</Button>}</div><InfoBanner tone="mint" icon="shield" title={t("nextStep")}>{t("confirmDeposit")}</InfoBanner><Button className="simulate-accept" variant="mint" onClick={onAccepted}><BadgeCheck />{t("simulateAccepted")}</Button><Button variant="ghost" onClick={onCancel}>{t("cancelRequest")}</Button></div></Panel>;
}

export function CompanionPaymentPage({ order, onPay }: { order: CompanionOrder; onPay: (method: string) => void }) {
  const { t } = useI18n();
  const [method, setMethod] = useState("kakao");
  const total = order.companion.price * 2;
  return <Panel className="payment-panel"><InfoBanner title={t("acceptedRequest", { name: order.companion.name })}>{t("depositDesc")}</InfoBanner><div className="payment-grid"><article><h3>{t("feeDetails")}</h3><dl><div><dt>{t("companionService", { hours: 2 })}</dt><dd>₩{formatWon(total)}</dd></div><div><dt>{t("deposit")}</dt><dd>₩{formatWon(order.deposit)}</dd></div><div><dt>{t("balanceAfter")}</dt><dd>₩{formatWon(total - order.deposit)}</dd></div></dl><div className="payment-total"><span>{t("thisPayment")}</span><strong>₩{formatWon(order.deposit)}</strong></div></article><article><h3>{t("paymentMethod")}</h3>{[["kakao", t("kakaoPay")], ["card", t("bankCard")], ["onsite", t("payOnSite")]].map(([value, label]) => <button key={value} className={method === value ? "selected" : ""} onClick={() => setMethod(value)}>{label}<i>{method === value ? "✓" : ""}</i></button>)}</article></div><div className="payment-actions"><InfoBanner tone="navy" icon="shield" title={t("paymentProtection")}>{t("paymentProtectionDesc")}</InfoBanner><Button onClick={() => onPay(method)}><WalletCards />{t("payAmount", { amount: formatWon(order.deposit) })}</Button></div></Panel>;
}

export function CompanionArrivedPage({ order, onMet, onProblem }: { order: CompanionOrder; onMet: (stream: MediaStream | null) => void; onProblem: () => void }) {
  const { t } = useI18n();
  const [requesting, setRequesting] = useState(false);
  function confirmMet() {
    if (requesting) return;
    setRequesting(true);
    // Enter the service screen immediately. Microphone permission can remain
    // pending indefinitely in some browsers, so recording attaches later if
    // the user grants it instead of blocking the care flow.
    try { onMet(null); }
    finally { setRequesting(false); }
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      const request = navigator.mediaDevices.getUserMedia({ audio: true });
      let active = true;
      const timeoutId = window.setTimeout(() => { active = false; }, 8_000);
      void request.then((stream) => {
        window.clearTimeout(timeoutId);
        if (active) onMet(stream);
        else stream.getTracks().forEach((track) => track.stop());
      }).catch(() => window.clearTimeout(timeoutId));
    } catch { /* The service continues with recording clearly shown as unavailable. */ }
  }
  return <Panel className="arrived-panel"><div className="arrived-profile"><NaruPose pose={18} className="companion-arrived-naru" /><span className="person-avatar xl">{order.companion.nativeName.slice(0, 1)}</span><h2>{order.companion.name}</h2><StatusPill>{t("companionArrived")}</StatusPill></div><div className="arrived-confirm"><h2>{t("companionArrived")}</h2><p>{t("arrivedAt", { hospital: order.hospital?.name || t("hospital") })}</p><InfoBanner title={t("confirmMet", { name: order.companion.name })} /><Button onClick={confirmMet} disabled={requesting}><UserRound />{requesting ? t("loading") : t("yesMet")}</Button><Button variant="ghost" onClick={onProblem}>{t("notMet")}</Button><InfoBanner tone="mint" icon="shield" title={t("nextStep")}>{t("arrivalNext")}</InfoBanner></div></Panel>;
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function CompanionServicePage({ order, stream, onEnd }: { order: CompanionOrder; stream: MediaStream | null; onEnd: () => void }) {
  const { t } = useI18n();
  const [remaining, setRemaining] = useState(order.durationMinutes * 60);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const chunkIndex = useRef(0);
  useEffect(() => {
    const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    if (stream && typeof MediaRecorder !== "undefined") {
      try {
        const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm" });
        recorderRef.current = recorder;
        recorder.ondataavailable = (event) => { if (event.data.size) { chunksRef.current.push(event.data); void api.uploadRecording(order.id, event.data, chunkIndex.current++); } };
        recorder.onerror = () => setRecording(false);
        recorder.start(10000); setRecording(true);
      } catch {
        recorderRef.current = null;
        setRecording(false);
        stream.getTracks().forEach((track) => track.stop());
      }
    }
    return () => { clearInterval(timer); if (recorderRef.current?.state === "recording") recorderRef.current.stop(); stream?.getTracks().forEach((track) => track.stop()); };
  }, [stream, order.id]);
  function end() { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); setRecording(false); onEnd(); }
  return <Panel className="service-panel"><div className="service-person"><NaruPose pose={19} className="companion-service-naru" /><span className="person-avatar xl">{order.companion.nativeName.slice(0, 1)}</span><h2>{order.companion.name}</h2><div><MapPinIcon />{order.hospital?.name}</div></div><div className="service-main"><span>{t("timeRemaining")}</span><strong className="service-time">{formatDuration(remaining)}</strong><StatusPill tone={recording ? "red" : "peach"}><Mic size={15} />{recording ? t("recordingProtected") : t("browserCallNote")}</StatusPill><div className="record-info"><ShieldCheck /><div><h3>{t("recordSaved")}</h3><p>{t("recordSavedDesc")}</p><p>{t("emergencyStill")}</p></div></div><div className="service-actions"><Button variant="secondary" onClick={() => setRemaining((value) => value + 1800)}>{t("extend30")}</Button><Button variant="danger" onClick={end}>{t("endService")}</Button></div></div></Panel>;
}

function MapPinIcon() { return <span aria-hidden="true">✚</span>; }

export function CompanionFinishedPage({ order, onPayBalance, onReview }: { order: CompanionOrder; onPayBalance: () => void; onReview: (rating: number, review: string) => void }) {
  const { t } = useI18n();
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [balancePaid, setBalancePaid] = useState(false);
  const total = order.companion.price * 2;
  function payBalance() { if (balancePaid) return; setBalancePaid(true); onPayBalance(); }
  return <Panel className="finished-panel"><div className="finished-success"><span>✓</span><h2>{t("serviceFinished")}</h2><p>{t("totalDuration", { hours: 2 })}</p></div><div className="finished-details"><article><h3>{t("settlement")}</h3><dl><div><dt>{t("serviceTotal")}</dt><dd>₩{formatWon(total)}</dd></div><div><dt>{t("depositPaid")}</dt><dd>-₩{formatWon(order.deposit)}</dd></div><div><dt>{t("balanceDue")}</dt><dd>₩{formatWon(total - order.deposit)}</dd></div></dl><Button onClick={payBalance} disabled={balancePaid}>{balancePaid ? t("confirm") : t("payBalance", { amount: formatWon(total - order.deposit) })}</Button></article><article className="rating-card"><h3>{t("rateCompanion", { name: order.companion.name })}</h3><div className="stars">{[1, 2, 3, 4, 5].map((value) => <button key={value} onClick={() => setRating(value)}><Star fill={value <= rating ? "currentColor" : "none"} /></button>)}</div><textarea value={review} onChange={(event) => setReview(event.target.value)} placeholder={t("reviewPlaceholder")} /><Button variant="mint" onClick={() => onReview(rating, review)}>{t("submitReview")}</Button></article></div></Panel>;
}
