import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CalendarClock, CreditCard, Download, Globe2, Languages, MapPin, PhoneCall, ReceiptText, ShieldCheck, Trash2, UserRound, Volume2 } from "lucide-react";
import { api } from "../api";
import { Button, formatWon, InfoBanner, NaruPose, Panel, StatusPill } from "../components";
import { buildKorean119Message, fallbackEmergencySymptomsKorean, isUsableKoreanTranslation } from "../emergencyKorean";
import { useI18n } from "../i18n";
import type { CompanionOrder, LocationState, SessionUser, VisitRecord } from "../types";

export function EmergencyConfirmPage({ hasCard, onCall, onDecline }: { hasCard: boolean; onCall: () => void; onDecline: () => void }) {
  const { t } = useI18n();
  function call() {
    onCall();
    window.setTimeout(() => { window.location.href = "tel:119"; }, 80);
  }
  function decline() { speechSynthesis.cancel(); onDecline(); }
  return <Panel className="emergency-confirm-panel"><div className="emergency-illustration"><div><AlertCircle /></div><NaruPose pose={9} className="emergency-confirm-naru" /></div><div className="emergency-copy"><strong>{t("dangerDetected")}</strong><h2>{t("emergencyQuestion")}</h2><InfoBanner tone="red" icon="location" title={t("emergencyActions")}>{t("emergencyActionsDesc")}</InfoBanner><Button variant="danger" onClick={call}><PhoneCall />{t("needCallNow")}</Button><Button variant="ghost" onClick={decline}>{t("declineCall")}</Button><p>{t("emergencyNoCardHint")}</p>{!hasCard && <StatusPill tone="red">{t("cardMissingShort")}</StatusPill>}</div></Panel>;
}

export function EmergencyCallingPage({ user, location, symptoms, active = true, onTranslation, onEnd }: { user: SessionUser; location: LocationState; symptoms: string; active?: boolean; onTranslation: () => void; onEnd: () => void }) {
  const { locale, t } = useI18n();
  const [looping, setLooping] = useState(false);
  const [cycle, setCycle] = useState(0);
  const replayTimer = useRef<number | null>(null);
  const name = user.card?.name || user.id || "UU";
  const coordinates = location.verified ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}${location.accuracy ? ` (±${Math.round(location.accuracy)}m)` : ""}` : "";
  const savedAddress = user.card?.address?.trim() || "";
  const savedKoreanAddress = user.card?.korean?.address?.trim() || savedAddress;
  const displayAddress = location.verified ? `${savedAddress || location.address} · GPS ${coordinates}` : savedAddress || t("locationDenied");
  const spokenAddress = location.verified ? `${savedKoreanAddress || location.address}, GPS 좌표 ${coordinates}` : savedKoreanAddress || "현재 위치 확인 중";
  const symptomText = user.card && symptoms && symptoms !== t("unknown") ? symptoms : "";
  const fallbackKoreanSymptoms = useMemo(() => symptomText ? fallbackEmergencySymptomsKorean(symptomText) : "", [symptomText]);
  const [koreanSymptoms, setKoreanSymptoms] = useState(fallbackKoreanSymptoms);
  const [translatingSymptoms, setTranslatingSymptoms] = useState(Boolean(symptomText));
  const korean = buildKorean119Message({ name, address: spokenAddress, koreanSymptoms: symptomText ? koreanSymptoms : undefined });
  const confirmation = t(symptomText ? "emergencyConfirmationKnown" : "emergencyConfirmationUnknown", { name, address: displayAddress, symptoms: symptomText });

  useEffect(() => {
    if (!symptomText) {
      setKoreanSymptoms("");
      setTranslatingSymptoms(false);
      return;
    }

    let active = true;
    let timeoutId = 0;
    setKoreanSymptoms(fallbackKoreanSymptoms);
    setTranslatingSymptoms(true);

    const timeout = new Promise<string>((resolve) => {
      timeoutId = window.setTimeout(() => resolve(""), 2_000);
    });
    void Promise.race([api.translate(symptomText, user.card?.language || locale, "ko"), timeout])
      .then((translated) => {
        if (active && isUsableKoreanTranslation(symptomText, translated)) setKoreanSymptoms(translated.trim());
      })
      .finally(() => {
        if (active) setTranslatingSymptoms(false);
        window.clearTimeout(timeoutId);
      });

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [fallbackKoreanSymptoms, locale, symptomText, user.card?.language]);

  useEffect(() => {
    if (!active || !looping || translatingSymptoms) return;
    const utterance = new SpeechSynthesisUtterance(korean); utterance.lang = "ko-KR"; utterance.rate = .82; utterance.volume = 1;
    utterance.onend = () => {
      if (!active || !looping) return;
      replayTimer.current = window.setTimeout(() => setCycle((value) => value + 1), 700);
    };
    speechSynthesis.cancel(); speechSynthesis.speak(utterance);
    return () => {
      if (replayTimer.current !== null) window.clearTimeout(replayTimer.current);
      replayTimer.current = null;
      speechSynthesis.cancel();
    };
  }, [active, looping, cycle, korean, translatingSymptoms]);

  useEffect(() => {
    if (active) return;
    setLooping(false);
    if (replayTimer.current !== null) window.clearTimeout(replayTimer.current);
    replayTimer.current = null;
    speechSynthesis.cancel();
  }, [active]);

  function toggleLoop() { if (!translatingSymptoms) setLooping((value) => !value); }
  function stopBroadcast() {
    setLooping(false);
    if (replayTimer.current !== null) window.clearTimeout(replayTimer.current);
    replayTimer.current = null;
    speechSynthesis.cancel();
  }
  function finish() { stopBroadcast(); onEnd(); }
  function openTranslation() { stopBroadcast(); onTranslation(); }

  return <Panel className="emergency-calling-panel"><div className="call-left"><NaruPose pose={8} className="emergency-calling-naru" /><div className="call-119">119</div><h2>{t("connecting119")}</h2><p>{location.verified || user.card?.address ? t("locationObtained") : t("locationDenied")}</p><div className="call-location"><MapPin /><span>{t("currentAddress")}<strong>{displayAddress}</strong></span></div><div className="call-actions"><Button variant="secondary" onClick={openTranslation}><Languages />{t("openEmergencyTranslation")}</Button><Button variant="danger" onClick={finish}><PhoneCall />{t("endCall")}</Button></div></div><div className="call-script"><strong>{looping ? t("koreanLoop") : t("startKoreanLoop")}</strong><article><p lang="ko">{korean}</p><Button variant="danger" onClick={toggleLoop} disabled={translatingSymptoms}><Volume2 />{translatingSymptoms ? t("loading") : looping ? t("autoLoop") : t("startKoreanLoop")}</Button></article><small>{t("chineseConfirmation")}</small><article><p>{confirmation}</p></article><p className="browser-note">{t("browserCallNote")}</p></div></Panel>;
}

export function ProfilePage({ user, recordsCount, ordersCount, onCard, onRecords, onOrders, onLanguage, onLogout }: { user: SessionUser; recordsCount: number; ordersCount: number; onCard: () => void; onRecords: () => void; onOrders: () => void; onLanguage: () => void; onLogout: () => void }) {
  const { option, t } = useI18n();
  const [dialog, setDialog] = useState<{ title: string; body: string } | null>(null);
  const items = [
    { icon: <CreditCard />, title: t("myMedicalCard"), sub: user.card ? t("cardCreated", { name: user.card.name }) : t("cardMissingShort"), action: onCard },
    { icon: <span>☷</span>, title: t("visitRecords"), sub: t("completedCount", { count: recordsCount }), action: onRecords },
    { icon: <UserRound />, title: t("companionOrders"), sub: t("orderCount", { count: ordersCount }), action: onOrders },
    { icon: <span>▣</span>, title: t("paymentMethods"), sub: t("notLinked"), action: () => setDialog({ title: t("paymentMethods"), body: t("paymentProtectionDesc") }) },
    { icon: <Globe2 />, title: t("languageSettings"), sub: option.nativeName, action: onLanguage },
    { icon: <ShieldCheck />, title: t("privacySecurity"), sub: t("passwordData"), action: () => setDialog({ title: t("privacySecurity"), body: t("privacyPromiseDesc") }) },
  ];
  return <><Panel className="profile-panel"><div className="profile-hero"><span>{user.card?.name?.slice(0, 2).toUpperCase() || user.id.slice(0, 2).toUpperCase()}</span><div><h2>{user.card?.name || user.id}</h2><p>{t("account", { id: user.id })}</p><StatusPill>{user.card ? t("cardCreated", { name: user.card.name }) : t("cardMissingShort")}</StatusPill></div><Button variant="ghost" onClick={onCard}>{t("editProfile")}</Button><NaruPose pose={20} className="profile-naru-pose" /></div><h3>{t("accountServices")}</h3><div className="profile-grid">{items.map((item) => <button key={item.title} onClick={item.action}><i>{item.icon}</i><strong>{item.title}<small>{item.sub}</small></strong><span>→</span></button>)}</div><div className="profile-footer"><InfoBanner tone="mint" icon="shield" title={t("privacyPromise")}>{t("privacyPromiseDesc")}</InfoBanner><Button variant="ghost" onClick={onLogout}>{t("logout")}</Button></div></Panel>{dialog && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={dialog.title}><div className="gate-modal account-dialog"><h2>{dialog.title}</h2><p>{dialog.body}</p><Button onClick={() => setDialog(null)}>{t("close")}</Button><button className="modal-close" onClick={() => setDialog(null)} aria-label={t("close")}>×</button></div></div>}</>;
}

type RecordDetailMode = "translation" | "companion" | "fees" | "full";

export function RecordsPage({ version = 0, onCountChange }: { version?: number; onCountChange?: (count: number) => void }) {
  const { t } = useI18n();
  const [records, setRecords] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [detail, setDetail] = useState<{ record: VisitRecord; title: string; mode: RecordDetailMode } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VisitRecord | null>(null);

  useEffect(() => {
    setLoading(true);
    void api.records().then((items) => { setRecords(items); onCountChange?.(items.length); }).finally(() => setLoading(false));
  }, [version, onCountChange]);

  const displayStatus = (status: string) => {
    const keys = { searching: "recordStatusSearching", hospital_selected: "recordStatusHospitalSelected", navigating: "recordStatusNavigating", arrived: "recordStatusArrived", companion_requested: "recordStatusCompanion", completed: "recordStatusCompleted", emergency: "emergencyCall" } as const;
    return status in keys ? t(keys[status as keyof typeof keys]) : status;
  };
  const orderStatusKeys = { requested: "orderRequested", accepted: "orderAccepted", deposit_paid: "orderDepositPaid", arrived: "orderArrived", in_service: "orderInService", completed: "orderCompleted", cancelled: "orderCancelled" } as const;
  const displayOrderStatus = (status: CompanionOrder["status"]) => t(orderStatusKeys[status]);

  const open = (record: VisitRecord, mode: RecordDetailMode, title: string) => setDetail({ record, mode, title });

  function exportRecord(record: VisitRecord) {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), product: "NaruCare", record }, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `NaruCare-${record.date.replaceAll(".", "-")}-${record.id.slice(0, 8)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  async function permanentlyDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    const deleted = await api.deleteRecord(deleteTarget.id);
    if (deleted) {
      const next = records.filter((record) => record.id !== deleteTarget.id);
      setRecords(next);
      onCountChange?.(next.length);
      if (detail?.record.id === deleteTarget.id) setDetail(null);
      setDeleteTarget(null);
    }
    setDeleting(false);
  }

  function detailContent(record: VisitRecord, mode: RecordDetailMode) {
    const translations = record.details?.translations || [];
    const companion = record.details?.companion;
    const fees = record.details?.fees;
    if (mode === "translation") return translations.length ? <div className="translation-record-list">{translations.map((entry, index) => <article key={`${entry.timestamp}-${index}`}><span>{entry.speaker === "patient" ? t("patientSpeaker") : t("staffSpeaker")} · {new Date(entry.timestamp).toLocaleString()}</span><strong dir="auto">{entry.sourceText}</strong><p dir="auto">{entry.translatedText}</p><small>{entry.sourceLanguage} → {entry.targetLanguage}</small></article>)}</div> : <div className="record-empty-detail"><Languages />{t("noTranslationRecord")}</div>;
    if (mode === "companion") return companion ? <dl><div><dt>{t("companion")}</dt><dd>{companion.name}</dd></div><div><dt>{t("orderStatus")}</dt><dd>{displayOrderStatus(companion.status)}</dd></div><div><dt>{t("estimatedDuration")}</dt><dd>{companion.durationMinutes} min</dd></div><div><dt>{t("hospital")}</dt><dd>{companion.hospital}</dd></div><div><dt>{t("orderNumber")}</dt><dd>{companion.orderId}</dd></div></dl> : <div className="record-empty-detail"><UserRound />{t("noCompanionRecord")}</div>;
    if (mode === "fees") return fees ? <dl><div><dt>{t("serviceTotal")}</dt><dd>₩{formatWon(fees.serviceTotal)}</dd></div><div><dt>{t("depositPaid")}</dt><dd>₩{formatWon(fees.depositPaid)}</dd></div><div><dt>{t("balanceDue")}</dt><dd>₩{formatWon(fees.balanceDue)}</dd></div><div><dt>{t("paymentMethod")}</dt><dd>{fees.paymentMethod || t("notLinked")}</dd></div><div><dt>{t("paymentStatus")}</dt><dd>{t(fees.status === "paid" ? "paymentPaid" : fees.status === "deposit_paid" ? "paymentDepositOnly" : "paymentUnpaid")}</dd></div></dl> : <div className="record-empty-detail"><ReceiptText />{t("noFeeRecord")}</div>;
    return <dl><div><dt>{t("hospital")}</dt><dd>{record.hospital}</dd></div><div><dt>{t("visitRecords")}</dt><dd>{record.date} · {displayStatus(record.status)}</dd></div><div><dt>{t("medicalStaff")}</dt><dd>{record.department}</dd></div><div><dt>{t("youSaid")}</dt><dd dir="auto">{record.symptoms}</dd></div><div><dt>{t("translationRecord")}</dt><dd>{t("entryCount", { count: translations.length })}</dd></div><div><dt>{t("companionRecord")}</dt><dd>{companion?.name || t("noCompanionRecord")}</dd></div></dl>;
  }

  return <>
    <Panel className="records-panel"><InfoBanner title={t("recordsDesc")}>{t("recordsSub")}</InfoBanner>{loading ? <p>{t("loading")}</p> : records.length ? <div className="records-list">{records.map((record) => <article key={record.id}><span>{record.date}</span><StatusPill>{displayStatus(record.status)}</StatusPill><h2>{record.hospital}</h2><p dir="auto">{record.department} · {record.symptoms}</p><div className="record-detail-actions"><button onClick={() => open(record, "translation", t("translationRecord"))}>{t("translationRecord")}</button><button onClick={() => open(record, "companion", t("companionRecord"))}>{t("companionRecord")}</button><button onClick={() => open(record, "fees", t("feeRecord"))}>{t("feeRecord")}</button><Button onClick={() => open(record, "full", t("viewFullRecord"))}>{t("viewFullRecord")}</Button></div><div className="record-manage-actions"><Button variant="secondary" onClick={() => exportRecord(record)}><Download />{t("exportRecord")}</Button><Button variant="ghost" onClick={() => setDeleteTarget(record)}><Trash2 />{t("deleteRecord")}</Button></div></article>)}</div> : <div className="empty-records"><NaruPose pose={21} /><h2>{t("noRecords")}</h2></div>}<InfoBanner tone="mint" icon="shield" title={t("recordManaged")}>{t("exportDelete")}</InfoBanner></Panel>
    {detail && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={detail.title}><div className={`gate-modal record-dialog record-dialog-${detail.mode}`}><h2>{detail.title}</h2>{detailContent(detail.record, detail.mode)}<Button onClick={() => setDetail(null)}>{t("close")}</Button><button className="modal-close" onClick={() => setDetail(null)} aria-label={t("close")}>×</button></div></div>}
    {deleteTarget && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t("deleteRecord")}><div className="gate-modal delete-record-dialog"><Trash2 /><h2>{t("deleteRecord")}</h2><p>{t("deleteRecordConfirm", { hospital: deleteTarget.hospital })}</p><div><Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>{t("cancel")}</Button><Button variant="danger" onClick={() => void permanentlyDelete()} disabled={deleting}>{deleting ? t("deleting") : t("deletePermanently")}</Button></div></div></div>}
  </>;
}

export function CompanionOrdersPage({ version = 0, onResume, onDeleted, onCountChange }: { version?: number; onResume: (order: CompanionOrder) => void; onDeleted?: (id: string) => void; onCountChange?: (count: number) => void }) {
  const { t } = useI18n();
  const [orders, setOrders] = useState<CompanionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<CompanionOrder | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  useEffect(() => { setLoading(true); void api.orders().then((items) => { setOrders(items); onCountChange?.(items.length); }).finally(() => setLoading(false)); }, [version, onCountChange]);
  const statusKeys = { requested: "orderRequested", accepted: "orderAccepted", deposit_paid: "orderDepositPaid", arrived: "orderArrived", in_service: "orderInService", completed: "orderCompleted", cancelled: "orderCancelled" } as const;
  const statusText = (status: CompanionOrder["status"]) => t(statusKeys[status]);
  async function permanentlyDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError("");
    const deleted = await api.deleteOrder(deleteTarget.id);
    if (deleted) {
      const next = orders.filter((order) => order.id !== deleteTarget.id);
      setOrders(next);
      onCountChange?.(next.length);
      onDeleted?.(deleteTarget.id);
      setDeleteTarget(null);
    } else setDeleteError(t("errorGeneric"));
    setDeleting(false);
  }
  return <>
    <Panel className="orders-panel"><InfoBanner icon="shield" title={t("companionOrders")}>{t("ordersDesc")}</InfoBanner>{loading ? <p>{t("loading")}</p> : orders.length ? <div className="orders-list">{orders.map((order) => <article key={order.id}><span className="person-avatar">{order.companion.nativeName.slice(0, 1)}</span><div><h2>{order.companion.name}</h2><StatusPill tone={order.status === "cancelled" ? "red" : "mint"}>{statusText(order.status)}</StatusPill><p><MapPin size={15} />{order.hospital?.name || t("hospital")}</p><small><CalendarClock size={14} />{order.createdAt ? new Date(order.createdAt).toLocaleString() : t("todayAt", { time: "16:00" })} · {order.durationMinutes} min</small><strong>₩{formatWon(order.deposit)} · {order.paymentMethod || t("notLinked")}</strong></div><div className="order-manage-actions">{!(["completed", "cancelled"] as string[]).includes(order.status) && <Button onClick={() => onResume(order)}>{t("resumeOrder")}</Button>}<Button variant="ghost" onClick={() => { setDeleteError(""); setDeleteTarget(order); }}><Trash2 />{t("deleteOrder")}</Button></div></article>)}</div> : <div className="empty-records"><NaruPose pose={7} /><h2>{t("noOrders")}</h2></div>}</Panel>
    {deleteTarget && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t("deleteOrder")}><div className="gate-modal delete-record-dialog"><Trash2 /><h2>{t("deleteOrder")}</h2><p>{t("deleteOrderConfirm", { name: deleteTarget.companion.name })}</p>{deleteError && <p className="form-error" role="alert">{deleteError}</p>}<div><Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>{t("cancel")}</Button><Button variant="danger" onClick={() => void permanentlyDelete()} disabled={deleting}>{deleting ? t("deleting") : t("deletePermanently")}</Button></div></div></div>}
  </>;
}
