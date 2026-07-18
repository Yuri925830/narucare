import { companions, fallbackHospitals, matchCompanions } from "./data";
import type { Companion, CompanionFilters, CompanionOrder, Hospital, MedicalCard, SessionUser, TranslationRecordEntry, VisitRecord } from "./types";

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "narucare-session";
const DEMO_USERS_KEY = "narucare-demo-users";
const DEMO_RECORDS_KEY = "narucare-demo-records";
const DEMO_ORDERS_KEY = "narucare-demo-orders";

interface ApiErrorPayload { error?: string; message?: string }

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 500, code = "unknown") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function token() {
  return localStorage.getItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 12_000): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !(init.body instanceof Blob)) headers.set("content-type", "application/json");
  if (token()) headers.set("authorization", `Bearer ${token()}`);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}${path}`, { ...init, headers, signal: init.signal || controller.signal });
    const payload = response.headers.get("content-type")?.includes("json") ? await response.json() as T & ApiErrorPayload : null;
    if (!response.ok) throw new ApiError(payload?.message || payload?.error || `HTTP ${response.status}`, response.status, payload?.error || "http_error");
    return payload as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

function readDemoUsers(): Record<string, { password: string; card: MedicalCard | null }> {
  try { return JSON.parse(localStorage.getItem(DEMO_USERS_KEY) || "{}"); } catch { return {}; }
}

function demoSession(id: string) {
  localStorage.setItem(TOKEN_KEY, `demo:${id}`);
}

function demoCurrentId() {
  const value = token();
  return value?.startsWith("demo:") ? value.slice(5) : null;
}

function demoUserStorageKey(base: string) {
  return `${base}:${demoCurrentId() || "anonymous"}`;
}

function allowDemo(error: unknown) {
  return import.meta.env.VITE_DEMO_MODE !== "false" && (error instanceof TypeError || (error instanceof DOMException && error.name === "AbortError"));
}

export const api = {
  isDemo: () => Boolean(demoCurrentId()),
  async logout() {
    if (!demoCurrentId() && token()) {
      try { await request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }); }
      catch { /* Local session removal still signs this browser out. */ }
    }
    localStorage.removeItem(TOKEN_KEY);
  },
  async register(id: string, password: string): Promise<SessionUser> {
    if (id.trim().length < 2 || id.length > 48 || !/^[\p{L}\p{N}_.-]+$/u.test(id.trim())) throw new ApiError("Invalid ID", 400, "invalid_id");
    try {
      const result = await request<{ token: string; user: SessionUser }>("/api/auth/register", { method: "POST", body: JSON.stringify({ id, password }) });
      localStorage.setItem(TOKEN_KEY, result.token);
      return result.user;
    } catch (error) {
      if (!allowDemo(error)) throw error;
      const users = readDemoUsers();
      if (users[id]) throw new ApiError("ID already registered", 409, "id_taken");
      users[id] = { password, card: null };
      localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users));
      demoSession(id);
      return { id, card: null };
    }
  },
  async login(id: string, password: string): Promise<SessionUser> {
    try {
      const result = await request<{ token: string; user: SessionUser }>("/api/auth/login", { method: "POST", body: JSON.stringify({ id, password }) });
      localStorage.setItem(TOKEN_KEY, result.token);
      return result.user;
    } catch (error) {
      if (!allowDemo(error)) throw error;
      const users = readDemoUsers();
      if (!users[id] || users[id].password !== password) throw new ApiError("Invalid ID or password", 401, "invalid_credentials");
      demoSession(id);
      return { id, card: users[id].card };
    }
  },
  async me(): Promise<SessionUser | null> {
    if (!token()) return null;
    if (demoCurrentId()) {
      const id = demoCurrentId()!;
      const entry = readDemoUsers()[id];
      if (!entry) return null;
      return { id, card: entry.card };
    }
    try { return await request<SessionUser>("/api/me"); }
    catch (error) {
      if (error instanceof ApiError && error.status === 401) void this.logout();
      return null;
    }
  },
  async saveCard(card: MedicalCard): Promise<MedicalCard> {
    if (demoCurrentId()) {
      const users = readDemoUsers();
      const id = demoCurrentId()!;
      users[id] = { ...users[id], card };
      localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users));
      return card;
    }
    return request<MedicalCard>("/api/card", { method: "PUT", body: JSON.stringify(card) });
  },
  async hospitals(lat: number, lng: number, symptom: string, locale = "en"): Promise<Hospital[]> {
    try {
      const params = new URLSearchParams({ lat: String(lat), lng: String(lng), symptom, locale });
      const data = await request<{ hospitals: Hospital[] }>(`/api/hospitals?${params}`);
      return data.hospitals;
    } catch {
      const nearSeoul = Math.abs(lat - 37.5665) < 0.45 && Math.abs(lng - 126.978) < 0.55;
      return nearSeoul ? fallbackHospitals.map((hospital, index) => ({ ...hospital, distance: hospital.distance + index * 160 })) : [];
    }
  },
  async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
      const data = await request<{ address: string }>(`/api/location/reverse?${params}`);
      return data.address;
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  },
  async route(origin: [number, number], destination: [number, number], mode: "walking" | "driving" = "walking") {
    try {
      const params = new URLSearchParams({
        startLat: String(origin[0]), startLng: String(origin[1]), endLat: String(destination[0]), endLng: String(destination[1]), mode,
      });
      const result = await request<{ coordinates: [number, number][]; distance: number; duration: number }>(`/api/route?${params}`);
      return { ...result, available: result.coordinates.length > 1 };
    } catch {
      return { coordinates: [] as [number, number][], distance: 0, duration: 0, available: false };
    }
  },
  async translate(text: string, source: string, target: string): Promise<string> {
    if (!text.trim()) return "";
    try {
      const data = await request<{ translated: string }>("/api/translate", { method: "POST", body: JSON.stringify({ text, source, target }) });
      return data.translated;
    } catch {
      const common: Record<string, string> = {
        "我从今天早上开始肚子很痛，一直腹泻，还吐了。我今天吃过海鲜。": "오늘 아침부터 배가 많이 아프고 설사와 구토를 했습니다. 오늘 해산물을 먹었습니다.",
        "해산물을 드셨나요? 열은 있습니까?": "Did you eat seafood? Do you have a fever?",
        "None": target.startsWith("ko") ? "없음" : "None",
        "无": target.startsWith("ko") ? "없음" : "None",
      };
      return common[text] || text;
    }
  },
  async transcribe(audio: Blob, language: string): Promise<string> {
    if (!audio.size) return "";
    const params = new URLSearchParams({ language });
    const data = await request<{ text: string }>(`/api/transcribe?${params}`, {
      method: "POST",
      body: audio,
      headers: { "content-type": audio.type || "audio/webm" },
    }, 45_000);
    return data.text.trim();
  },
  async chat(message: string, locale: string, hasCard: boolean) {
    try {
      return await request<{ reply: string; intent: "emergency" | "hospital" | "card" | "general" }>("/api/chat", {
        method: "POST", body: JSON.stringify({ message, locale, hasCard }),
      });
    } catch {
      return { reply: "", intent: "general" as const };
    }
  },
  async getCompanions(filters: CompanionFilters): Promise<Companion[]> {
    try {
      const data = await request<{ companions: Companion[] }>("/api/companions", { method: "POST", body: JSON.stringify(filters) });
      return data.companions.length ? data.companions : matchCompanions(filters);
    } catch { return matchCompanions(filters); }
  },
  async createOrder(order: Omit<CompanionOrder, "id">): Promise<CompanionOrder> {
    if (demoCurrentId()) {
      const created = { ...order, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      const key = demoUserStorageKey(DEMO_ORDERS_KEY);
      const orders = JSON.parse(localStorage.getItem(key) || "[]") as CompanionOrder[];
      localStorage.setItem(key, JSON.stringify([created, ...orders]));
      return created;
    }
    return request<CompanionOrder>("/api/orders", { method: "POST", body: JSON.stringify(order) });
  },
  async updateOrder(id: string, status: CompanionOrder["status"], extra: Record<string, unknown> = {}) {
    if (demoCurrentId()) {
      const key = demoUserStorageKey(DEMO_ORDERS_KEY);
      const orders = JSON.parse(localStorage.getItem(key) || "[]") as CompanionOrder[];
      const updated = orders.map((order) => order.id === id ? {
        ...order,
        status,
        ...(typeof extra.paymentMethod === "string" ? { paymentMethod: extra.paymentMethod } : {}),
        ...(extra.balancePaid === true ? { balancePaid: true } : {}),
        ...(typeof extra.rating === "number" ? { rating: extra.rating } : {}),
        ...(typeof extra.review === "string" ? { review: extra.review } : {}),
        updatedAt: new Date().toISOString(),
      } : order);
      localStorage.setItem(key, JSON.stringify(updated));
      return { ok: true };
    }
    try { return await request<{ ok: boolean }>(`/api/orders/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status, ...extra }) }); }
    catch { return { ok: false }; }
  },
  async orders(): Promise<CompanionOrder[]> {
    if (demoCurrentId()) return JSON.parse(localStorage.getItem(demoUserStorageKey(DEMO_ORDERS_KEY)) || "[]") as CompanionOrder[];
    try { return (await request<{ orders: CompanionOrder[] }>("/api/orders")).orders; }
    catch { return []; }
  },
  async uploadRecording(orderId: string, chunk: Blob, index: number) {
    if (demoCurrentId()) return { stored: false, local: true };
    try {
      return await request<{ stored: boolean }>(`/api/orders/${encodeURIComponent(orderId)}/recordings/${index}`, {
        method: "PUT", body: chunk, headers: { "content-type": chunk.type || "audio/webm" },
      });
    } catch { return { stored: false }; }
  },
  async addRecord(record: Omit<VisitRecord, "id">): Promise<VisitRecord> {
    const complete = { ...record, id: crypto.randomUUID() };
    if (demoCurrentId()) {
      const key = demoUserStorageKey(DEMO_RECORDS_KEY);
      const records = JSON.parse(localStorage.getItem(key) || "[]") as VisitRecord[];
      localStorage.setItem(key, JSON.stringify([complete, ...records]));
      return complete;
    }
    try { return await request<VisitRecord>("/api/records", { method: "POST", body: JSON.stringify(record) }); }
    catch { return complete; }
  },
  async updateRecord(id: string, patch: Partial<Omit<VisitRecord, "id">>) {
    if (demoCurrentId()) {
      const key = demoUserStorageKey(DEMO_RECORDS_KEY);
      const records = JSON.parse(localStorage.getItem(key) || "[]") as VisitRecord[];
      const updated = records.map((record) => record.id === id ? {
        ...record,
        ...patch,
        ...(patch.details ? { details: { ...record.details, ...patch.details } } : {}),
      } : record);
      localStorage.setItem(key, JSON.stringify(updated));
      return updated.find((record) => record.id === id) || null;
    }
    try { return await request<VisitRecord>(`/api/records/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) }); }
    catch { return null; }
  },
  async appendRecordTranslation(id: string, entry: TranslationRecordEntry) {
    if (demoCurrentId()) {
      const key = demoUserStorageKey(DEMO_RECORDS_KEY);
      const records = JSON.parse(localStorage.getItem(key) || "[]") as VisitRecord[];
      const updated = records.map((record) => record.id === id ? {
        ...record,
        details: { ...record.details, translations: [...(record.details?.translations || []), entry].slice(-100) },
      } : record);
      localStorage.setItem(key, JSON.stringify(updated));
      return updated.find((record) => record.id === id) || null;
    }
    try { return await request<VisitRecord>(`/api/records/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ appendTranslation: entry }) }); }
    catch { return null; }
  },
  async deleteRecord(id: string) {
    if (demoCurrentId()) {
      const key = demoUserStorageKey(DEMO_RECORDS_KEY);
      const records = JSON.parse(localStorage.getItem(key) || "[]") as VisitRecord[];
      localStorage.setItem(key, JSON.stringify(records.filter((record) => record.id !== id)));
      return true;
    }
    try { await request<{ ok: boolean }>(`/api/records/${encodeURIComponent(id)}`, { method: "DELETE" }); return true; }
    catch { return false; }
  },
  async records(): Promise<VisitRecord[]> {
    if (demoCurrentId()) return JSON.parse(localStorage.getItem(demoUserStorageKey(DEMO_RECORDS_KEY)) || "[]");
    try { return (await request<{ records: VisitRecord[] }>("/api/records")).records; }
    catch { return []; }
  },
  allCompanions: companions,
};
