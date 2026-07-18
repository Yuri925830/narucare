import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import { AppShell, LanguageSelector, NaruPose, Panel } from "./components";
import { getDefaultFilters } from "./data";
import { I18nProvider, useI18n } from "./i18n";
import { requestPreciseLocation } from "./location";
import { AuthPage } from "./pages/AuthPage";
import { AgentPage, HospitalsPage, NavigationPage, TranslationPage, VisitFlowPage } from "./pages/CarePages";
import {
  CompanionArrivedPage, CompanionChatPage, CompanionDetailPage, CompanionFilterPage, CompanionFinishedPage,
  CompanionListPage, CompanionNoticePage, CompanionPaymentPage, CompanionServicePage, CompanionWaitingPage,
} from "./pages/CompanionPages";
import { CompanionOrdersPage, EmergencyCallingPage, EmergencyConfirmPage, ProfilePage, RecordsPage } from "./pages/EmergencyProfilePages";
import { MedicalCardPage } from "./pages/MedicalCardPage";
import type { Companion, CompanionFilters, CompanionOrder, Hospital, LocationState, MedicalCard, SessionUser, View, VisitRecord, VisitRecordDetails } from "./types";

export function App() {
  return <I18nProvider><AppInner /></I18nProvider>;
}

const defaultLocation: LocationState = { lat: 37.5665, lng: 126.978, address: "서울특별시", verified: false };

function orderRecordDetails(order: CompanionOrder, status = order.status, paymentMethod = order.paymentMethod, balancePaid = Boolean(order.balancePaid)): VisitRecordDetails {
  const serviceTotal = Math.round(order.companion.price * order.durationMinutes / 60);
  const depositPaid = ["deposit_paid", "arrived", "in_service", "completed"].includes(status) ? order.deposit : 0;
  const paidBalance = balancePaid ? Math.max(0, serviceTotal - depositPaid) : 0;
  return {
    companion: {
      orderId: order.id,
      name: order.companion.name,
      status,
      durationMinutes: order.durationMinutes,
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
  const [filters, setFilters] = useState<CompanionFilters>(() => getDefaultFilters(locale));
  const [people, setPeople] = useState<Companion[]>(api.allCompanions);
  const [selectedCompanion, setSelectedCompanion] = useState<Companion>(api.allCompanions[0]);
  const [order, setOrder] = useState<CompanionOrder | null>(null);
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
  const [recordsCount, setRecordsCount] = useState(0);
  const [recordsVersion, setRecordsVersion] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [ordersVersion, setOrdersVersion] = useState(0);
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);
  const [visitSessionVersion, setVisitSessionVersion] = useState(0);

  useEffect(() => { void api.me().then((current) => { if (current) setUser(current); }).finally(() => setChecking(false)); }, []);
  useEffect(() => {
    if (!user) return;
    void refreshLocation();
    void Promise.all([api.records(), api.orders()]).then(([records, orders]) => { setRecordsCount(records.length); setOrdersCount(orders.length); });
  }, [user?.id]);
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
    try {
      const point = await requestPreciseLocation(navigator.geolocation, { targetAccuracyMeters: 8, hardTimeoutMs: 35_000, minimumObservationMs: 5_000, minimumAccurateSamples: 2 });
      const reverseAddress = await api.reverseGeocode(point.lat, point.lng);
      // GPS decides proximity and emergency coordinates. A user-entered door
      // address is more precise for people, so never replace it with the name
      // of a nearby road returned by reverse geocoding.
      const address = user?.card?.address?.trim() || reverseAddress;
      const next: LocationState = { ...point, address, verified: true };
      setLocation(next);
      return next;
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
    const clean = text.trim();
    if (!clean || clean === t("unknown")) return;
    setSymptoms(clean);
    const card = user?.card;
    if (!card || card.symptoms === clean) return;
    const nextCard: MedicalCard = { ...card, symptoms: clean, korean: { ...(card.korean || {}), symptoms: clean } };
    setUser((current) => current ? { ...current, card: nextCard } : current);
    try {
      const koreanSymptoms = await api.translate(clean, card.language || locale, "ko");
      const translated: MedicalCard = { ...nextCard, korean: { ...(nextCard.korean || {}), symptoms: koreanSymptoms } };
      setUser((current) => current ? { ...current, card: translated } : current);
      await api.saveCard(translated);
    } catch {
      await api.saveCard(nextCard).catch(() => undefined);
    }
  }, [locale, t, user?.card]);

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
    const effectiveSymptoms = nextSymptoms.trim() || user?.card?.symptoms?.trim() || symptoms;
    if (nextSymptoms.trim()) void captureSymptoms(nextSymptoms);
    setSymptoms(effectiveSymptoms);
    setHospitalsLoading(true);
    setHospitals([]);
    setSelectedHospital(null);
    goTo("hospitals");
    const recordPromise = beginVisitRecord(effectiveSymptoms);
    try {
      const current = await refreshLocation();
      const results = current.verified ? await api.hospitals(current.lat, current.lng, effectiveSymptoms, locale) : [];
      setHospitals(results);
      setSelectedHospital(results[0] || null);
      if (results[0]) void recordPromise.then((recordId) => updateCurrentRecord({ hospital: results[0].name, status: "hospital_selected" }, recordId));
    } finally { setHospitalsLoading(false); }
  }, [beginVisitRecord, captureSymptoms, goTo, locale, refreshLocation, symptoms, updateCurrentRecord, user?.card?.symptoms]);

  function navigate(next: View) {
    if (!user) return;
    const allowedWithoutCard: View[] = ["agent", "card", "emergency-confirm", "emergency-calling", "language", "profile", "records"];
    if (!user.card && !allowedWithoutCard.includes(next)) {
      goTo("agent");
      setGateSignal((value) => value + 1);
      return;
    }
    if (next === "emergency-confirm") void beginEmergencyRecord(symptoms || user.card?.symptoms || "");
    goTo(next);
  }

  function openLanguage() { goTo("language"); }

  async function match() {
    goTo("companions");
    setPeople(await api.getCompanions(filters));
  }

  async function applyForCompanion(person = selectedCompanion) {
    setSelectedCompanion(person);
    const created = await api.createOrder({ companion: person, hospital: selectedHospital, status: "requested", durationMinutes: 120, deposit: Math.round(person.price * 2 * .1), paymentMethod: "" });
    setOrder(created);
    setOrdersCount((value) => value + 1);
    setOrdersVersion((value) => value + 1);
    void updateCurrentRecord({ status: "companion_requested", details: orderRecordDetails(created) });
    goTo("companion-waiting");
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
    const updated = { ...order, status: "in_service" as const };
    setOrder(updated);
    goTo("companion-service");
    setOrdersVersion((value) => value + 1);
    void api.updateOrder(order.id, "in_service");
    void updateCurrentRecord({ details: orderRecordDetails(updated) });
  }

  async function endService() {
    if (!order) return;
    const updated = { ...order, status: "completed" as const };
    setOrder(updated); goTo("companion-finished");
    setOrdersVersion((value) => value + 1);
    await api.updateOrder(order.id, "completed");
    await updateCurrentRecord({ status: "completed", hospital: order.hospital?.name || t("hospital"), symptoms: symptoms || user?.card?.symptoms || t("unknown"), details: orderRecordDetails(updated) });
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
    setOrder(nextOrder);
    setSelectedCompanion(nextOrder.companion);
    const destination: View = {
      requested: "companion-waiting",
      accepted: "companion-payment",
      deposit_paid: "companion-arrived",
      arrived: "companion-arrived",
      in_service: "companion-service",
      completed: "companion-finished",
      cancelled: "companions",
    }[nextOrder.status] as View;
    goTo(destination);
  }

  const resetVisitSession = useCallback(async (destination: "agent" | "records" | "card") => {
    recordingStream?.getTracks().forEach((track) => track.stop());
    setRecordingStream(null);
    setSymptoms("");
    setHospitals([]);
    setHospitalsLoading(false);
    setSelectedHospital(null);
    setFilters(getDefaultFilters(locale));
    setPeople(api.allCompanions);
    setSelectedCompanion(api.allCompanions[0]);
    setOrder(null);
    setCurrentRecordId(null);
    setVisitSessionVersion((value) => value + 1);
    setViewHistory(destination === "agent" ? [] : ["agent"]);
    setVisitedViews(destination === "agent" ? ["agent"] : ["agent", destination]);
    setView(destination);

    const card = user?.card;
    if (card && (card.symptoms || card.korean?.symptoms)) {
      const clearedCard: MedicalCard = { ...card, symptoms: "", korean: { ...(card.korean || {}), symptoms: "" } };
      setUser((current) => current ? { ...current, card: clearedCard } : current);
      await api.saveCard(clearedCard).catch(() => undefined);
    }
  }, [locale, recordingStream, user?.card]);

  async function finishVisitAssistance() {
    await updateCurrentRecord({ status: "completed" });
    await resetVisitSession("agent");
  }

  const titles: Record<View, string> = {
    agent: "Naru", card: t("createCard"), hospitals: t("nearbyHospitals"), "visit-flow": t("navFlow"), navigation: t("navigationRoute"), translation: t("translationConversation"),
    "companions-notice": t("companionsNotice"), "companions-filter": t("companionConditions"), companions: t("companionsTitle"), "companion-detail": t("companionDetail"), "companion-chat": t("companionChat"),
    "companion-waiting": t("waitingConfirmation"), "companion-payment": t("payDeposit"), "companion-arrived": t("companionArrived"), "companion-service": t("serviceInProgress"), "companion-finished": t("serviceFinished"), "companion-orders": t("companionOrders"),
    "emergency-confirm": t("emergencyCall"), "emergency-calling": t("calling119"), profile: t("profileTitle"), records: t("recordsTitle"), language: t("chooseLanguage"),
  };

  if (checking) return <div className="app-loading"><NaruPose pose={2} /><span>{t("loading")}</span></div>;
  if (!user) return <AuthPage onAuthenticated={(current) => { setUser(current); setView("agent"); setViewHistory([]); setVisitedViews(["agent"]); }} />;

  const renderView = (target: View): ReactNode => {
    switch (target) {
      case "card": return <MedicalCardPage card={user.card} onSaved={(card) => { setUser({ ...user, card }); goBack(); }} />;
      case "agent": return <AgentPage key={`visit-${visitSessionVersion}`} card={user.card} onCard={() => goTo("card")} onEmergency={(value) => { void captureSymptoms(value); void beginEmergencyRecord(value); setSymptoms(value); goTo("emergency-confirm"); }} onHospitals={openHospitals} onSymptoms={(value) => void captureSymptoms(value)} onFlow={() => goTo("visit-flow")} onTranslation={() => goTo("translation")} onCompanion={() => goTo("companions-notice")} gateSignal={gateSignal} />;
      case "hospitals": return <HospitalsPage location={location} hospitals={hospitals} loading={hospitalsLoading} selected={selectedHospital} onSelect={(hospital) => { setSelectedHospital(hospital); void updateCurrentRecord({ hospital: hospital.name, status: "hospital_selected" }); }} onFlow={() => goTo("visit-flow")} onCompanion={() => goTo("companions-notice")} onRoute={() => { void updateCurrentRecord({ hospital: selectedHospital?.name || t("hospital"), status: "navigating" }); goTo("navigation"); }} onRefresh={async () => { setHospitalsLoading(true); try { const next = await refreshLocation(); const results = next.verified ? await api.hospitals(next.lat, next.lng, symptoms, locale) : []; setHospitals(results); setSelectedHospital(results[0] || null); } finally { setHospitalsLoading(false); } }} />;
      case "visit-flow": return <VisitFlowPage onStart={() => selectedHospital ? goTo("navigation") : void openHospitals(symptoms)} onReturn={() => goBack()} />;
      case "navigation": return selectedHospital ? <NavigationPage location={location} hospital={selectedHospital} onArrived={() => { void updateCurrentRecord({ status: "arrived" }); goTo("translation"); }} onTranslation={() => goTo("translation")} /> : <Panel><p>{t("noHospitalsFound")}</p></Panel>;
      case "translation": return <TranslationPage userLanguage={user.card?.language || locale} active={view === "translation"} onRecorded={(entry) => { if (currentRecordId) void api.appendRecordTranslation(currentRecordId, entry).then(() => setRecordsVersion((value) => value + 1)); }} onComplete={() => void finishVisitAssistance()} />;
      case "companions-notice": return <CompanionNoticePage onContinue={() => goTo("companions-filter")} />;
      case "companions-filter": return <CompanionFilterPage filters={filters} onChange={setFilters} onMatch={() => void match()} />;
      case "companions": return <CompanionListPage people={people} onFilters={() => goTo("companions-filter")} onDetail={(person) => { setSelectedCompanion(person); goTo("companion-detail"); }} onChoose={applyForCompanion} />;
      case "companion-detail": return <CompanionDetailPage person={selectedCompanion} onChat={() => goTo("companion-chat")} onApply={() => applyForCompanion()} />;
      case "companion-chat": return <CompanionChatPage person={selectedCompanion} hospitalName={selectedHospital?.name || t("hospital")} onApply={() => applyForCompanion()} />;
      case "companion-waiting": return order ? <CompanionWaitingPage person={order.companion} onAccepted={() => void acceptOrder()} onMessage={() => goTo("companion-chat")} onCancel={() => { void api.updateOrder(order.id, "cancelled"); setOrder(null); goTo("companions"); }} /> : <Panel />;
      case "companion-payment": return order ? <CompanionPaymentPage order={order} onPay={(method) => void payDeposit(method)} /> : <Panel />;
      case "companion-arrived": return order ? <CompanionArrivedPage order={order} onMet={startCompanionService} onProblem={() => goTo("companion-chat")} /> : <Panel />;
      case "companion-service": return order ? <CompanionServicePage order={order} stream={recordingStream} onEnd={() => void endService()} /> : <Panel />;
      case "companion-finished": return order ? <CompanionFinishedPage order={order} onPayBalance={payCompanionBalance} onReview={(rating, review) => void submitCompanionReview(rating, review)} /> : <Panel />;
      case "companion-orders": return <CompanionOrdersPage version={ordersVersion} onResume={resumeOrder} />;
      case "emergency-confirm": return <EmergencyConfirmPage hasCard={Boolean(user.card)} onCall={() => { void refreshLocation(); goTo("emergency-calling"); }} onDecline={() => user.card ? void openHospitals(symptoms || user.card.symptoms || "") : goTo("card")} />;
      case "emergency-calling": return <EmergencyCallingPage user={user} location={location} symptoms={symptoms || user.card?.symptoms || ""} active={view === "emergency-calling"} onTranslation={() => goTo("translation")} onEnd={() => { void (async () => { await updateCurrentRecord({ status: "completed" }); await resetVisitSession(user.card ? "agent" : "card"); })(); }} />;
      case "profile": return <ProfilePage user={user} recordsCount={recordsCount} ordersCount={ordersCount} onCard={() => goTo("card")} onRecords={() => goTo("records")} onOrders={() => goTo("companion-orders")} onLanguage={openLanguage} onLogout={() => { void api.logout(); setUser(null); setViewHistory([]); setVisitedViews(["agent"]); }} />;
      case "records": return <RecordsPage version={recordsVersion} onCountChange={setRecordsCount} />;
      case "language": return <Panel className="in-app-language"><h2>{t("chooseLanguage")}</h2><p>{t("languageSubtitle")}</p><LanguageSelector compact onDone={goBack} /></Panel>;
      default: return null;
    }
  };

  return <AppShell view={view} title={titles[view]} user={user} onNavigate={navigate} onLanguage={openLanguage} onBack={goBack} canGoBack={viewHistory.length > 0}>
    <div className="view-preserver">{visitedViews.map((target) => <section key={target} className={`preserved-view ${target === view ? "active" : ""}`} hidden={target !== view} aria-hidden={target !== view}>{renderView(target)}</section>)}</div>
  </AppShell>;
}
