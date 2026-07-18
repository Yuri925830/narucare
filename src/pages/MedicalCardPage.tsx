import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { BadgeCheck, Languages, LocateFixed, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { Button, InfoBanner, NaruPose, Panel } from "../components";
import { countryKoreanName, countryOptions, findCountry } from "../countries";
import { localeOptions, useI18n } from "../i18n";
import { formatAccuracy, requestPreciseLocation } from "../location";
import type { MedicalCard } from "../types";

type CardField = "name" | "nationality" | "address" | "age" | "gender" | "documentType" | "documentNumber" | "insurance" | "conditions" | "medications" | "surgeries" | "symptoms" | "notes" | "language";

const koreanLabels: Record<CardField, string> = {
  name: "이름 / 호칭", nationality: "국적", age: "나이", gender: "성별", documentType: "신분증 종류",
  address: "현재 거주지 (선택)", documentNumber: "신분증 번호", insurance: "한국 건강보험", conditions: "만성질환 / 알레르기",
  medications: "현재 복용 약물", surgeries: "수술 / 중요 병력", symptoms: "현재 증상", notes: "기타 메모", language: "주요 통역 언어",
};

function emptyCard(language: string): MedicalCard {
  return {
    name: "", nationality: "", address: "", age: "", gender: "female", documentType: "alien", documentNumber: "",
    insurance: "yes", conditions: "", medications: "", surgeries: "", symptoms: "", notes: "", language,
  };
}

function koreanLanguageName(value: string) {
  try { return new Intl.DisplayNames(["ko"], { type: "language" }).of(value) || value; }
  catch { return localeOptions.find((item) => item.code === value)?.englishName || value; }
}

export function MedicalCardPage({ card, onSaved }: { card: MedicalCard | null; onSaved: (card: MedicalCard) => void }) {
  const { locale, t } = useI18n();
  const [form, setForm] = useState<MedicalCard>(() => card ? { ...emptyCard(card.language || locale), ...card } : emptyCard(locale));
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [saved, setSaved] = useState(Boolean(card));
  const [error, setError] = useState("");
  const addressEdited = useRef(Boolean(card?.address));

  useEffect(() => {
    if (card) { setForm({ ...emptyCard(card.language || locale), ...card }); setSaved(true); }
  }, [card, locale]);

  const fields = useMemo(() => [
    { key: "name" as const, label: t("name"), required: true },
    { key: "nationality" as const, label: t("nationality"), country: true, required: true },
    { key: "address" as const, label: t("residentialAddress"), placeholder: t("addressOptional"), multiline: true },
    { key: "age" as const, label: t("age"), type: "number", required: true },
    { key: "gender" as const, label: t("gender"), options: [["female", t("female")], ["male", t("male")], ["other", t("other")]] },
    { key: "documentType" as const, label: t("documentType"), options: [["alien", t("alienRegistration")], ["passport", t("passport")]] },
    { key: "documentNumber" as const, label: t("documentNumber"), required: true },
    { key: "insurance" as const, label: t("insurance"), options: [["yes", t("yes")], ["no", t("no")]] },
    { key: "conditions" as const, label: t("conditions"), placeholder: t("none"), multiline: true },
    { key: "medications" as const, label: t("medications"), placeholder: t("none"), multiline: true },
    { key: "surgeries" as const, label: t("surgeries"), placeholder: t("none"), multiline: true },
    { key: "symptoms" as const, label: t("currentSymptoms"), placeholder: t("symptomsHelp"), multiline: true },
    { key: "notes" as const, label: t("notes"), placeholder: t("none"), multiline: true },
    { key: "language" as const, label: t("primaryLanguage"), options: localeOptions.map((item) => [item.code, item.nativeName]) },
  ], [t]);

  const locateAddress = useCallback(async (forceAddressUpdate = false) => {
    setLocationError("");
    if (!navigator.geolocation) { setLocationError(t("locationDenied")); return; }
    setLocating(true);
    try {
      const point = await requestPreciseLocation(navigator.geolocation, { targetAccuracyMeters: 8, hardTimeoutMs: 35_000, minimumObservationMs: 5_000, minimumAccurateSamples: 2 });
      const address = await api.reverseGeocode(point.lat, point.lng);
      setForm((current) => ({
        ...current,
        address: forceAddressUpdate || !addressEdited.current ? address : current.address,
        latitude: point.lat,
        longitude: point.lng,
        locationAccuracy: point.accuracy,
      }));
    } catch { setLocationError(t("locationDenied")); }
    finally { setLocating(false); }
  }, [t]);

  useEffect(() => { if (!card?.address) void locateAddress(false); }, []);

  function localKoreanValue(key: CardField, value: string) {
    const common: Record<string, string> = {
      female: "여성", male: "남성", other: "기타 / 응답하지 않음", alien: "외국인등록증", passport: "여권",
      yes: "있음", no: "없음", None: "없음", 无: "없음", "": "없음",
    };
    if (key === "nationality") return countryKoreanName(value);
    if (key === "language") return koreanLanguageName(value);
    return common[value] || value;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const textKeys = ["address", "conditions", "medications", "surgeries", "symptoms", "notes"] as const;
      const translated = await Promise.all(textKeys.map(async (key) => [key, await api.translate(form[key] || t("none"), form.language, "ko")] as const));
      const korean: Record<string, string> = Object.fromEntries(fields.map((field) => [field.key, localKoreanValue(field.key, String(form[field.key] || t("none")))]));
      translated.forEach(([key, value]) => { korean[key] = value; });
      korean.nationality = countryKoreanName(form.nationality);
      korean.language = koreanLanguageName(form.language);
      const result = await api.saveCard({ ...form, korean });
      setForm(result); setSaved(true); onSaved(result);
    } catch { setError(t("errorGeneric")); }
    finally { setSaving(false); }
  }

  const legacyCountry = form.nationality && !findCountry(form.nationality) ? form.nationality : "";

  return <Panel className="medical-card-panel">
    <InfoBanner title={t("personalCard")} icon="shield" action={<div className="banner-character"><span className="soft-chip">{t("editable")}</span><NaruPose pose={4} className="medical-card-naru" /></div>}>{t("cardPrivacy")}</InfoBanner>
    {saved && <div className="bilingual-heading"><Languages size={20} /><div><strong>{t("bilingualCard")}</strong><small>{t("userLanguage")} · {localeOptions.find((item) => item.code === form.language)?.nativeName} / 한국어</small></div></div>}
    <form className="medical-card-form" onSubmit={submit}>
      {fields.map((field) => {
        const key = field.key;
        const value = String(form[key] ?? "");
        const options = "options" in field ? field.options : null;
        return <label key={key} data-field={key}>
          <span>{field.label}{saved && <em> / {koreanLabels[key]}</em>}</span>
          {"country" in field && field.country ? <select value={value} required onChange={(event) => setForm({ ...form, nationality: event.target.value })}>
            <option value="">— {t("nationality")} —</option>
            {legacyCountry && <option value={legacyCountry}>{legacyCountry}</option>}
            {countryOptions.map((country) => <option key={country.code} value={country.code}>{country.flag} {country.nativeName}</option>)}
          </select> : options ? <select value={value} onChange={(event) => setForm({ ...form, [key]: event.target.value })}>{options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select> : "multiline" in field && field.multiline ? <textarea dir="auto" value={value} onChange={(event) => { if (key === "address") addressEdited.current = true; setForm({ ...form, [key]: event.target.value }); }} placeholder={("placeholder" in field && field.placeholder) || ""} required={"required" in field && field.required} /> : <input dir="auto" type={("type" in field && field.type) || "text"} min={key === "age" ? 0 : undefined} max={key === "age" ? 120 : undefined} value={value} onChange={(event) => setForm({ ...form, [key]: event.target.value })} placeholder={("placeholder" in field && field.placeholder) || ""} required={"required" in field && field.required} />}
          {key === "address" && <><Button type="button" variant="secondary" className="locate-address" onClick={() => { addressEdited.current = false; void locateAddress(true); }} disabled={locating}><LocateFixed size={16} />{locating ? t("locating") : t("useCurrentLocation")}</Button><small className="address-help">{t("addressHelp")}{form.locationAccuracy ? ` · ${t("locationAccuracy", { accuracy: formatAccuracy(form.locationAccuracy) })}` : ""}</small>{locationError && <small className="form-error" role="alert">{locationError}</small>}</>}
          {key === "symptoms" && <small className="address-help">{t("symptomsAutoFill")}</small>}
          {saved && <small className="korean-preview"><BadgeCheck size={13} />{form.korean?.[key] || localKoreanValue(key, value)}</small>}
        </label>;
      })}
      {error && <p className="form-error span-2">{error}</p>}
      <p className="card-footer"><ShieldCheck size={15} />{t("cardFooter")}</p>
      <Button type="submit" disabled={saving}><ShieldCheck size={19} />{saving ? t("loading") : t("submitCard")}</Button>
    </form>
  </Panel>;
}
