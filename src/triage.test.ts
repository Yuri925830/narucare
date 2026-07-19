import { describe, expect, it } from "vitest";
import { assessMedicalIntent, extractReportableSymptoms, hasMedicalSymptoms, isAffirmativeResponse, isHospitalCommandWithoutSymptoms, isMedicalKnowledgeQuestion, isNaruCapabilityQuestion, isNaruIdentityQuestion, isNegativeResponse, isSymptomsResolvedStatement } from "./triage";

describe("medical triage", () => {
  it.each([
    "就发高烧，看不见东西",
    "我现在无法呼吸，很痛苦",
    "I cannot breathe and have severe chest pain",
    "No puedo respirar",
    "숨을 쉴 수 없고 가슴이 너무 아파요",
    "息ができなくて、激しい胸痛があります",
    "我已经割腕大出血，我想自杀",
  ])("routes red flags to emergency: %s", (message) => {
    expect(assessMedicalIntent(message).intent).toBe("emergency");
  });

  it("uses previous symptoms when the user asks for a hospital in the next turn", () => {
    const result = assessMedicalIntent("那你帮我找医院啊", ["就发高烧，看不见东西"]);
    expect(result.intent).toBe("emergency");
    expect(result.symptoms).toContain("高烧");
  });

  it.each([
    "肚子疼，一直拉肚子还吐了，今天吃了海鲜",
    "I have a fever and cough",
    "열이 나고 기침이 나요",
    "Tengo fiebre y tos",
    "J'ai de la fièvre et je tousse",
    "Tôi bị sốt và ho",
  ])("routes non-red-flag symptoms to hospitals: %s", (message) => {
    expect(assessMedicalIntent(message).intent).toBe("hospital");
  });

  it("honors an explicit hospital request and carries prior symptom context", () => {
    const result = assessMedicalIntent("帮我找附近医院", ["昨天开始咳嗽发烧"]);
    expect(result.intent).toBe("hospital");
    expect(result.symptoms).toBe("昨天开始咳嗽发烧");
  });

  it("does not invent symptoms for a context-free nearby hospital request", () => {
    const result = assessMedicalIntent("附近医院");
    expect(result.intent).toBe("hospital");
    expect(result.reason).toBe("hospital_request");
    expect(result.symptoms).toBe("");
    expect(extractReportableSymptoms("附近医院")).toBe("");
    expect(isHospitalCommandWithoutSymptoms("附近医院")).toBe(true);
  });

  it("keeps service commands out of the medical card and 119 symptom broadcast", () => {
    expect(extractReportableSymptoms("帮我找附近医院")).toBe("");
    expect(extractReportableSymptoms("呼叫119")).toBe("");
    expect(extractReportableSymptoms("我现在无法呼吸，很痛苦")).toContain("无法呼吸");
    expect(extractReportableSymptoms("帮我找附近医院，我肚子疼")).toBe("我肚子疼");
    expect(extractReportableSymptoms("呼叫119，我无法呼吸")).toBe("我无法呼吸");
  });

  it("marks a symptom report as requiring consent rather than an explicit hospital request", () => {
    const result = assessMedicalIntent("我刚刚吃了个蛋糕，肚子有点疼");
    expect(result.intent).toBe("hospital");
    expect(result.reason).toBe("symptoms");
    expect(result.symptoms).toContain("蛋糕");
  });

  it.each(["好的", "可以", "ok", "OK!", "yes", "네", "はい", "sí", "oui", "نعم"])("recognizes a short multilingual hospital-search confirmation: %s", (message) => {
    expect(isAffirmativeResponse(message)).toBe(true);
  });

  it.each(["暂时不用", "先不用", "no thanks", "아니요", "いいえ", "non", "لا"])("recognizes a short multilingual hospital-search decline: %s", (message) => {
    expect(isNegativeResponse(message)).toBe(true);
  });

  it.each([
    "我又没事了",
    "我已经好了",
    "症状都消失了",
    "我现在不疼了",
    "没事了",
    "我肚子不疼了",
    "我的肚子已经不疼了",
    "头已经不痛了",
    "我已经不吐也不拉了",
    "好吧，我肚子不疼了",
    "I'm fine now",
    "My symptoms are gone",
    "이제 괜찮아졌어요",
    "もう大丈夫です",
  ])("recognizes an explicit symptom-recovery update: %s", (message) => {
    expect(isSymptomsResolvedStatement(message)).toBe(true);
    expect(extractReportableSymptoms(message)).toBe("");
    expect(assessMedicalIntent(message).intent).toBe("recovery");
  });

  it.each([
    "我还没好",
    "我没有好转",
    "症状还没有消失",
    "我还是肚子疼",
    "我没事了吗？",
    "I'm not better",
    "I still feel sick",
    "아직 안 나았어요",
    "まだ治っていない",
  ])("does not clear symptoms for unresolved or questioning language: %s", (message) => {
    expect(isSymptomsResolvedStatement(message)).toBe(false);
  });

  it.each([
    "肚子不疼了但还在吐",
    "我不发烧了，不过仍然咳嗽",
    "不是不疼，是更疼了",
  ])("does not erase remaining active symptoms after partial or contradicted recovery: %s", (message) => {
    expect(isSymptomsResolvedStatement(message)).toBe(false);
  });

  it.each(["可以根治吗", "好的睡眠有什么作用", "okay but what is insomnia?"])("does not mistake a longer question for hospital-search consent: %s", (message) => {
    expect(isAffirmativeResponse(message)).toBe(false);
  });

  it("does not turn an explicitly negated chest pain statement into an emergency", () => {
    expect(assessMedicalIntent("我没有胸痛，只是想了解韩国医院怎么预约").intent).not.toBe("emergency");
  });

  it("keeps ordinary conversation general", () => {
    expect(assessMedicalIntent("谢谢你，Naru").intent).toBe("general");
    expect(hasMedicalSymptoms("谢谢你，Naru")).toBe(false);
  });

  it.each([
    "失眠吃安眠药可以根治吗",
    "什么是失眠",
    "高血压有哪些症状",
    "抗生素有哪些副作用",
    "Can sleeping pills cure insomnia?",
    "睡眠药能治好失眠吗",
    "胸痛有哪些常见原因？",
    "发烧时需要去医院吗？",
    "What causes high blood pressure?",
    "불면증은 완치할 수 있나요?",
    "不眠症とは何ですか？",
  ])("answers general medical knowledge without starting a hospital search: %s", (message) => {
    expect(isMedicalKnowledgeQuestion(message)).toBe(true);
    expect(assessMedicalIntent(message).intent).toBe("education");
    expect(assessMedicalIntent(message).symptoms).toBe("");
  });

  it.each([
    "我失眠三天了，而且白天一直头晕",
    "我现在发烧咳嗽",
    "I have had a fever and cough for two days",
  ])("distinguishes a current personal symptom from a knowledge question: %s", (message) => {
    expect(isMedicalKnowledgeQuestion(message)).toBe(false);
    expect(assessMedicalIntent(message).intent).toBe("hospital");
  });

  it("keeps emergency red flags above educational phrasing", () => {
    expect(assessMedicalIntent("我胸痛是为什么").intent).toBe("emergency");
    expect(assessMedicalIntent("我现在无法呼吸，这是怎么回事").intent).toBe("emergency");
  });

  it("treats duration without a pronoun as an active personal symptom", () => {
    expect(assessMedicalIntent("发烧三天了怎么办").intent).toBe("hospital");
  });

  it("recognizes Naru identity and capability questions as conversation", () => {
    expect(isNaruIdentityQuestion("你是谁？")).toBe(true);
    expect(isNaruCapabilityQuestion("你能做什么")).toBe(true);
    expect(assessMedicalIntent("你是谁？").intent).toBe("general");
  });

  it("never carries an earlier knowledge question into a later symptom summary", () => {
    const result = assessMedicalIntent("我现在发烧咳嗽", ["失眠吃安眠药可以根治吗"]);
    expect(result.intent).toBe("hospital");
    expect(result.symptoms).not.toContain("安眠药");
  });

  it.each([
    ["How do I prepare documents for a Korean hospital?", "flow"],
    ["告诉我去韩国医院的就诊流程", "flow"],
    ["帮我打开翻译对话", "translation"],
    ["我需要一名真人陪诊师", "companion"],
    ["我要修改就诊卡", "card"],
  ])("routes service request '%s' to %s", (message, intent) => {
    expect(assessMedicalIntent(message).intent).toBe(intent);
  });
});
