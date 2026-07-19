export type MedicalIntent = "emergency" | "hospital" | "card" | "flow" | "translation" | "companion" | "education" | "general";

export interface MedicalTriageResult {
  intent: MedicalIntent;
  symptoms: string;
  reason: "red_flag" | "symptoms" | "hospital_request" | "card_request" | "service_request" | "education_request" | "none";
}

const CARD_REQUEST = /(就诊卡|診療カード|진료카드|medical\s*card|create\s*(?:a\s*)?card|建卡|建立.*卡)/iu;
const FLOW_REQUEST = /(就诊流程|就医流程|看病流程|去医院.{0,8}(?:准备|带什么|证件)|需要.{0,8}(?:材料|证件)|携带.{0,5}(?:材料|证件)|hospital\s+(?:visit\s+)?process|how.{0,20}(?:prepare|visit).{0,20}hospital|what.{0,12}(?:bring|documents).{0,20}hospital|prepare.{0,15}documents.{0,20}hospital|진료\s*절차|병원.{0,8}(?:준비|서류)|受診.{0,5}(?:流れ|手続|書類)|(?:proceso|trámite).{0,12}hospital|documents?.{0,12}(?:hôpital|clinique)|krankenhaus.{0,12}(?:ablauf|unterlagen)|больниц.{0,12}(?:документ|процесс)|إجراءات.{0,12}المستشفى)/iu;
const TRANSLATION_REQUEST = /(翻译(?:对话|沟通)?|帮我翻译|语言沟通|translate|translation|interpreter|interpretation|통역|번역|翻訳|通訳|traduc|traduction|übersetz|перевод|ترجم|terjemah|dịch)/iu;
const COMPANION_REQUEST = /(真人陪诊|陪诊师|陪诊|陪我去医院|medical\s+companion|human\s+companion|patient\s+escort|동행|동행인|付き添|acompañante|accompagnement|begleit|сопровожд|مرافق|pendamping)/iu;
const HOSPITAL_REQUEST = /(帮我|替我|给我|麻烦)?(?:找|查|推荐|寻找).{0,8}(?:医院|诊所|急诊)|(?:附近|周边).{0,5}(?:医院|诊所)|(?:去|想去|要去|需要去).{0,4}(?:医院|急诊)|find\s+(?:me\s+)?(?:a\s+|nearby\s+)?(?:hospital|clinic)|go\s+to\s+(?:a\s+|the\s+)?hospital|nearby\s+(?:hospital|clinic)|병원.{0,6}(?:찾|추천)|가까운\s*병원|병원.{0,4}(?:가고|갈래)|病院.{0,6}(?:探|見つ|行き)|(?:buscar|encontrar|recomendar).{0,12}(?:hospital|clínica)|(?:trouver|chercher|recommander).{0,12}(?:hôpital|clinique)|(?:krankenhaus|klinik).{0,10}(?:finden|suchen)|(?:hospital|clínica).{0,10}(?:próximo|perto)|найти.{0,12}(?:больниц|клиник)|مستشفى.{0,12}(?:قريب|ابحث)|(?:rumah sakit|klinik).{0,12}(?:cari|dekat)|(?:bệnh viện|phòng khám).{0,12}(?:tìm|gần)/iu;

// Knowledge questions can contain the same disease and symptom words as a
// personal complaint. They must be recognized before the generic symptom
// route, while emergency red flags always retain higher priority.
const KNOWLEDGE_REQUEST = /(医学知识|医疗知识|健康知识|科普|什么是|是什么意思|为什么会|原因(?:是什么|有哪些)?|如何预防|怎么预防|怎么办|如何治疗|怎么治疗|能不能.{0,16}(?:根治|治好|预防)|可以.{0,16}(?:根治|治好|预防)吗|是否.{0,16}(?:根治|治好|预防)|(?:有什么|有哪些).{0,8}(?:症状|原因|危害|副作用|治疗方法)|(?:药|药物|安眠药|抗生素).{0,20}(?:作用|副作用|成瘾|依赖|安全吗|能否|可以|会不会|根治)|what\s+(?:is|are|causes?)|why\s+(?:does|do|is|are|can)|symptoms?\s+of|how\s+(?:to\s+)?(?:prevent|treat|manage)|can.{0,24}(?:cure|prevent)|is.{0,24}(?:safe|addictive)|side\s*effects?|medical\s+(?:knowledge|information)|health\s+information|무엇(?:인가요|입니까)|왜\s*생기|원인(?:은|이)|예방(?:하는)?\s*방법|치료(?:하는)?\s*방법|완치.{0,8}(?:가능|할\s*수)|부작용|의학\s*지식|とは|なぜ|原因|予防(?:方法|するには)|治療(?:方法|するには)|完治|副作用|qué\s+es|por\s+qué|cómo\s+(?:prevenir|tratar)|efectos?\s+secundarios?|qu['’]?est-ce|pourquoi|comment\s+(?:prévenir|traiter)|effets?\s+secondaires?|was\s+ist|warum|wie\s+(?:verhindern|behandeln)|nebenwirkungen|что\s+такое|почему|как\s+(?:предотвратить|лечить)|побочн|ما\s+هو|لماذا|كيفية\s+(?:الوقاية|العلاج)|آثار\s+جانبية)/iu;
const STRONG_CURRENT_CONTEXT = /((?:我|本人|患者).{0,8}(?:现在|目前|今天|刚刚|刚才|这几天|最近|已经|一直|正在|突然|开始|持续|越来越)|(?:现在|目前|今天|刚刚|刚才).{0,8}(?:我|本人)|(?:已经)?(?:\d+|[一二三四五六七八九十两几])(?:天|小时|周|个月)(?:了|一直)?|从(?:今天|昨天|前天|早上|晚上).{0,6}(?:开始|起)|\b(?:i\s+(?:am|have|feel|cannot|can't)|i['’]?m|i['’]?ve\s+been|my\s+.{0,18}(?:hurts?|aches?|pain)|right\s+now|today|for\s+\d+\s+days?)\b|(?:저는|제가|나는|내가).{0,12}(?:지금|오늘|며칠째|계속|갑자기|아파|있어요|있습니다)|(?:지금|오늘|며칠째).{0,10}(?:아파|통증|증상)|(?:私は|僕は|自分は).{0,12}(?:今|今日|数日|ずっと|急に|痛|症状)|(?:今|今日).{0,10}(?:痛|苦し|症状)|\b(?:yo\s+(?:tengo|siento|estoy)|je\s+(?:suis|ressens|j['’]?ai)|ich\s+(?:habe|fühle|bin)|eu\s+(?:tenho|sinto|estou))\b)/iu;
const PERSONAL_SYMPTOM_CONTEXT = /(?:我|本人).{0,10}(?:疼|痛|不舒服|难受|发烧|发热|咳嗽|头晕|恶心|乏力|过敏|出血|肿|麻木|呼吸|喘|腹泻|呕吐|拉肚子|皮疹|受伤|看不清|视力模糊|心悸|失眠|便血|尿血)/iu;
const EDUCATIONAL_SELF_FRAME = /(?:我|本人)(?:只是)?(?:想|希望|打算)(?:了解|知道|问|咨询|学习)|\bi\s+(?:want|would\s+like)\s+to\s+(?:know|learn|ask)|(?:저는|제가).{0,6}(?:궁금|알고\s*싶)|私は.{0,6}(?:知りたい|聞きたい)/iu;
const MEDICAL_TOPIC = /(疾病|病症|症状|治疗|预防|医院|医生|药|药物|疫苗|检查|手术|感染|睡眠|血压|血糖|cholesterol|disease|condition|symptom|treatment|medicine|medication|drug|vaccine|doctor|hospital|질병|증상|치료|예방|약|병원|病気|症状|治療|予防|薬|病院)/iu;
const QUESTION_FORM = /[?？]|(?:吗|呢|么|인가요|습니까|ですか|ますか)$/iu;

const IDENTITY_QUESTION = /^(?:(?:嗨|你好|请问)[，,\s]*)?(?:(?:你|naru|你们)(?:到底)?(?:是(?:谁|什么)|叫什么(?:名字)?|是什么(?:人|东西|助手)?)|who\s+are\s+you|what\s+are\s+you|what['’]?s\s+your\s+name|너(?:는|가)?\s*누구|이름이\s*뭐|あなたは誰|お名前は|quién\s+eres|qui\s+es-tu|wer\s+bist\s+du|кто\s+ты|من\s+أنت)[？?!.。\s]*$/iu;
const CAPABILITY_QUESTION = /^(?:(?:嗨|你好|请问)[，,\s]*)?(?:(?:你|naru)(?:可以|能|会)(?:帮我)?(?:做|干|提供)(?:什么|哪些)|what\s+can\s+you\s+do|how\s+can\s+you\s+help|what\s+do\s+you\s+do|무엇을\s+할\s+수|뭘\s+도와|何ができ|何をしてくれる|qué\s+puedes\s+hacer|que\s+peux-tu\s+faire|was\s+kannst\s+du|что\s+ты\s+умеешь|ماذا\s+يمكنك\s+أن\s+تفعل)[？?!.。\s]*$/iu;

// These are deliberately anchored, short consent utterances. A substring
// match such as "可以根治吗" must never be mistaken for consent to leave the
// conversation and start a hospital search.
const AFFIRMATIVE_RESPONSE = /^(?:(?:好|好的|好啊|可以|可以的|行|行啊|没问题|当然|同意|要|需要|麻烦你|拜托了|帮我找|请帮我找)(?:吧|啊|呀|的)?|(?:yes|yeah|yep|yup|ok|okay|sure|please|go\s+ahead|do\s+it|sounds\s+good)|(?:네|예|응|좋아요|그래요|알겠습니다|찾아\s*주세요|부탁해요)|(?:はい|ええ|いいです|お願いします|探してください)|(?:sí|si|claro|vale|de\s+acuerdo|por\s+favor)|(?:oui|d['’]?accord|bien\s+sûr|s['’]?il\s+vous\s+plaît)|(?:ja|okay|klar|bitte)|(?:sim|claro|está\s+bem|por\s+favor)|(?:да|хорошо|конечно|пожалуйста)|(?:نعم|حسنًا|موافق|من\s+فضلك)|(?:ya|iya|baik|boleh|tolong)|(?:vâng|được|đồng\s+ý|làm\s+ơn))[.!。！,，\s]*$/iu;
const NEGATIVE_RESPONSE = /^(?:(?:不|不用|不用了|不需要|暂时不用|先不用|不想去|算了|不了|谢谢不用)(?:了|吧|啊)?|(?:no|nope|not\s+now|no\s+thanks?|don['’]?t|do\s+not)|(?:아니요|아니|괜찮아요|지금은\s*아니요)|(?:いいえ|今はいいです|大丈夫です)|(?:no|ahora\s+no|no\s+gracias)|(?:non|pas\s+maintenant|non\s+merci)|(?:nein|jetzt\s+nicht|nein\s+danke)|(?:não|agora\s+não|não\s+obrigado)|(?:нет|не\s+сейчас|нет\s+спасибо)|(?:لا|ليس\s+الآن|لا\s+شكرًا)|(?:tidak|belum|tidak\s+perlu)|(?:không|chưa|không\s+cần))[.!。！,，\s]*$/iu;

// Recovery is a medical-state update, not ordinary small talk. Keep the
// positive patterns narrow and reject explicit unresolved wording first so
// phrases such as “还没好” can never erase an active symptom by accident.
const UNRESOLVED_SYMPTOMS = /(?:还没(?:好|恢复|退烧)|(?:没有|没)(?:好转|恢复|消失)|症状.{0,5}(?:还在|没消失|没有消失)|还是.{0,6}(?:不舒服|难受|疼|痛|吐|呕吐|拉肚子|腹泻|发烧)|并没有.{0,5}(?:好|恢复)|\b(?:not\s+(?:better|fine|okay|recovered)|haven['’]?t\s+recovered|symptoms?\s+(?:are\s+)?not\s+gone|still\s+(?:sick|unwell|hurts?|in\s+pain))\b|아직.{0,8}(?:안\s*나았|아프|증상)|좋아지지\s*않|여전히.{0,6}아프|まだ.{0,8}(?:治っていない|痛い|症状)|良くなっていない)/iu;
const RESOLVED_SYMPTOMS = /(?:^(?:(?:我|我又|我现在|我已经|现在我|已经|现在)?(?:完全)?(?:没事|好了|好起来了|恢复了|恢复正常了)(?:了|啦)?|(?:我|我现在|我已经|现在我|已经|现在)?(?:不疼|不痛|不吐|不呕吐|不拉肚子|不腹泻|不发烧|不难受)(?:了|啦)?|(?:症状|不舒服).{0,5}(?:消失了|没有了|没了|好了)|退烧了)[。.!！\s]*$|\b(?:i(?:['’]?m|\s+am)\s+(?:fine|okay|better)\s+now|i(?:['’]?ve|\s+have)\s+(?:fully\s+)?recovered|my\s+symptoms?\s+(?:are\s+)?gone|it\s+doesn['’]?t\s+hurt\s+anymore|i\s+no\s+longer\s+feel\s+sick)\b|^(?:이제\s*)?(?:괜찮아졌어요?|다\s*나았어요?|회복했어요?|증상이?\s*없어졌어요?|더\s*이상\s*아프지\s*않아요)[.!！。\s]*$|^(?:もう)?(?:大丈夫です?|治りました|回復しました|症状がなくなりました|痛くなくなりました)[.!！。\s]*$)/iu;

const EMERGENCY_REQUEST = /(?:呼叫|拨打|打)(?:救护车|119)|(?:需要|叫).*救护车|call\s+(?:an\s+)?ambulance|call\s*119|구급차|119.{0,5}(?:전화|불러)|救急車|119番|ambulancia|ambulance|krankenwagen|скорая|سيارة إسعاف/iu;
const RED_FLAG = /(无法呼吸|不能呼吸|喘不上气|呼吸(?:非常|极其|严重)?困难|窒息|胸(?:口)?(?:剧烈|严重)?疼?痛|心口(?:剧烈|严重)?疼?痛|昏迷|失去意识|叫不醒|大出血|血止不住|抽搐|癫痫发作|口唇发紫|嘴唇发紫|喉咙(?:肿|堵)|严重过敏|过敏性休克|突然失明|突然看不见|看不见东西|一侧(?:身体)?无力|半边身子无力|口角歪|说话不清|割腕|自杀|想死|不想活|伤害自己|服毒|药物过量|中毒|can't\s*breathe|cannot\s*breathe|difficulty\s*breathing|shortness\s*of\s*breath|choking|severe\s*chest\s*pain|unconscious|unresponsive|severe\s*bleeding|bleeding\s*won't\s*stop|seizure|blue\s*lips|anaphylaxis|throat\s*(?:is\s*)?closing|sudden\s*(?:vision\s*loss|blindness)|can't\s*see|cannot\s*see|one-sided\s*weakness|slurred\s*speech|suicid|kill\s*myself|overdose|poison|숨을?\s*(?:못|쉴\s*수\s*없)|호흡\s*곤란|심한\s*가슴\s*통증|의식\s*(?:없|잃)|깨지\s*않|대량\s*출혈|경련|입술이?\s*파래|아나필락시스|갑자기\s*안\s*보|한쪽\s*마비|자살|죽고\s*싶|과다\s*복용|息ができない|呼吸困難|激しい胸痛|意識がない|大量出血|けいれん|突然見えない|自殺|死にたい|no\s+puedo\s+respirar|dificultad\s+para\s+respirar|dolor\s+fuerte\s+en\s+el\s+pecho|inconsciente|sangrado\s+intenso|je\s+ne\s+peux\s+pas\s+respirer|difficulté\s+à\s+respirer|douleur\s+thoracique\s+intense|bewusstlos|starke\s+brustschmerzen|не\s+могу\s+дышать|сильная\s+боль\s+в\s+груди|لا\s*أستطيع\s*التنفس|ألم\s*شديد\s*في\s*الصدر)/iu;

const HIGH_FEVER = /(高烧|高熱|高热|体温.{0,5}(?:39|40|41|42)|(?:39|40|41|42)(?:度|℃)|high\s*fever|fever.{0,8}(?:39|40|41|42)|고열|열이.{0,5}(?:39|40|41|42)|高熱|fiebre\s+alta|forte\s+fièvre|hohes\s+fieber|febre\s+alta|высокая\s+температура|حمى\s*شديدة|demam\s+tinggi|sốt\s+cao)/iu;
const NEURO_OR_VISION = /(视力模糊|看不清|看不见|眼前发黑|意识模糊|神志不清|胡言乱语|脖子僵硬|剧烈头痛|blurred\s+vision|vision\s+loss|can't\s+see|confus|stiff\s+neck|worst\s+headache|시야가?\s*흐|안\s*보|의식\s*혼미|심한\s*두통|目がかすむ|見えない|意識がもうろう|激しい頭痛|visión\s+borrosa|confusión|vision\s+floue|verwirr|затуманенное\s+зрение|تشوش\s*الرؤية)/iu;
const SEVERE_MODIFIER = /(剧烈|严重|非常痛|痛得受不了|无法站立|持续恶化|severe|extreme|unbearable|worst|rapidly\s+worsening|심한|극심|激しい|intenso|grave|sévère|stark|schwer|сильн|شديد)/iu;
const SERIOUS_SYMPTOM = /(头痛|腹痛|肚子痛|出血|呕吐|发烧|发热|胸痛|过敏|受伤|烧伤|pain|headache|abdominal|bleed|vomit|fever|allerg|injur|burn|통증|두통|복통|출혈|구토|발열|알레르|부상|痛|頭痛|腹痛|出血|嘔吐|発熱|けが)/iu;

const SYMPTOM = /(疼|痛|不舒服|难受|发烧|发热|高烧|发冷|咳嗽|头晕|眩晕|恶心|乏力|无力|过敏|出血|肿|麻木|呼吸|喘|腹泻|呕吐|拉肚子|皮疹|受伤|看不清|看不见|视力模糊|耳鸣|流鼻涕|喉咙|心悸|失眠|便血|尿血|pain|hurt|unwell|fever|chills|cough|dizz|nause|weak|allerg|bleed|swollen|numb|breath|diarrhea|vomit|rash|injur|blurred\s+vision|can't\s+see|sore\s+throat|palpitation|아프|통증|불편|열이|발열|오한|기침|어지|메스꺼|구토|설사|알레르|출혈|붓|저림|호흡|다쳤|시야|안\s*보|목이|痛い|苦しい|発熱|咳|めまい|吐き気|嘔吐|下痢|発疹|出血|腫れ|しびれ|息|見え|喉|fiebre|dolor|tos|mareo|náusea|vómito|diarrea|sangrado|fièvre|douleur|toux|vertige|nausée|vomissement|durchfall|schmerz|fieber|husten|schwindel|übelkeit|febre|dor|tosse|tontura|náusea|температур|боль|кашель|тошнот|рвот|диаре|حمى|ألم|سعال|دوار|غثيان|قيء|إسهال|demam|sakit|batuk|pusing|mual|muntah|diare|sốt|đau|(?:^|[\s,.;!?])ho(?:$|[\s,.;!?])|chóng mặt|buồn nôn|nôn|tiêu chảy)/iu;
const FOLLOW_UP = /^(是|有|对|嗯|还有|而且|刚才|现在|越来越|那|那么|所以|这种情况|yes|yeah|also|and|now|worse|맞아|네|그리고|지금|はい|ある|それと)\b/iu;

function normalize(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function removeCommonNegations(value: string) {
  return value
    .replace(/(?:没有|没|并无|否认|不是|不再)(?:出现|发生|感觉|感到|任何)?\s*(?:胸痛|胸口痛|呼吸困难|出血|抽搐|昏迷)/gu, "")
    .replace(/\b(?:no|not|without|deny|denies|denied)\s+(?:any\s+)?(?:chest\s+pain|difficulty\s+breathing|bleeding|seizures?|fainting)\b/giu, "")
    .replace(/(?:없|아니).{0,4}(?:가슴\s*통증|호흡\s*곤란|출혈|경련)/gu, "");
}

export function hasMedicalSymptoms(value: string) {
  const clean = removeCommonNegations(normalize(value));
  return clean.length >= 2 && SYMPTOM.test(clean);
}

export function isMedicalKnowledgeQuestion(value: string) {
  const clean = normalize(value);
  if (!clean) return false;
  const knowledgeWording = KNOWLEDGE_REQUEST.test(clean);
  const generalMedicalQuestion = QUESTION_FORM.test(clean) && (hasMedicalSymptoms(clean) || MEDICAL_TOPIC.test(clean));
  if (!knowledgeWording && !generalMedicalQuestion) return false;
  if (STRONG_CURRENT_CONTEXT.test(clean)) return false;
  if (EDUCATIONAL_SELF_FRAME.test(clean)) return true;
  return !PERSONAL_SYMPTOM_CONTEXT.test(clean);
}

export function isNaruIdentityQuestion(value: string) {
  return IDENTITY_QUESTION.test(normalize(value));
}

export function isNaruCapabilityQuestion(value: string) {
  return CAPABILITY_QUESTION.test(normalize(value));
}

export function isAffirmativeResponse(value: string) {
  return AFFIRMATIVE_RESPONSE.test(normalize(value));
}

export function isNegativeResponse(value: string) {
  return NEGATIVE_RESPONSE.test(normalize(value));
}

export function isSymptomsResolvedStatement(value: string) {
  const clean = normalize(value);
  if (!clean || /[?？]/u.test(clean) || UNRESOLVED_SYMPTOMS.test(clean)) return false;
  return RESOLVED_SYMPTOMS.test(clean);
}

function symptomSummary(current: string, previous: string[]) {
  const candidates = [...previous.slice(-6), current]
    .map(normalize)
    .filter((value) => value && !isMedicalKnowledgeQuestion(value) && (hasMedicalSymptoms(value) || RED_FLAG.test(removeCommonNegations(value))));
  return [...new Set(candidates)].join("；").slice(0, 1_000);
}

function stripServiceCommands(value: string) {
  const servicePatterns = [HOSPITAL_REQUEST, EMERGENCY_REQUEST, CARD_REQUEST, FLOW_REQUEST, TRANSLATION_REQUEST, COMPANION_REQUEST];
  return servicePatterns
    .reduce((current, pattern) => current.replace(new RegExp(pattern.source, "giu"), " "), normalize(value))
    .replace(/^[\s,，;；。.!！?？:：—-]+|[\s,，;；。.!！?？:：—-]+$/gu, "")
    .trim();
}

/**
 * Returns only text that contains an actual symptom or red-flag description.
 * Navigation/service commands such as “附近医院” and “呼叫 119” deliberately
 * return an empty string so they can never enter the medical card or broadcast.
 */
export function extractReportableSymptoms(value: string) {
  if (isSymptomsResolvedStatement(value)) return "";
  const verified = symptomSummary(value, []);
  if (!verified) return "";
  const symptomsOnly = stripServiceCommands(verified);
  return symptomSummary(symptomsOnly, []);
}

export function isHospitalCommandWithoutSymptoms(value: string) {
  const clean = normalize(value);
  return Boolean(clean && HOSPITAL_REQUEST.test(clean) && !extractReportableSymptoms(clean));
}

export function assessMedicalIntent(message: string, previousUserMessages: string[] = [], hasCard = true): MedicalTriageResult {
  const current = normalize(message);
  if (!current) return { intent: "general", symptoms: "", reason: "none" };
  if (isSymptomsResolvedStatement(current)) return { intent: "general", symptoms: "", reason: "none" };
  if (CARD_REQUEST.test(current)) return { intent: "card", symptoms: "", reason: "card_request" };

  const asksForKnowledge = isMedicalKnowledgeQuestion(current);
  const asksForHospital = HOSPITAL_REQUEST.test(current) && !asksForKnowledge;
  const currentHasSymptoms = hasMedicalSymptoms(current);
  const isFollowUp = FOLLOW_UP.test(current);
  const priorSymptoms = previousUserMessages.map(normalize).filter((value) => !isMedicalKnowledgeQuestion(value) && (hasMedicalSymptoms(value) || RED_FLAG.test(removeCommonNegations(value)))).slice(-6);
  const includeHistory = asksForHospital || isFollowUp || (currentHasSymptoms && !asksForKnowledge);
  const relevant = removeCommonNegations(includeHistory ? [...priorSymptoms, current].join("；") : current);
  const symptoms = symptomSummary(current, previousUserMessages);

  const redFlag = EMERGENCY_REQUEST.test(current)
    || (!asksForKnowledge && (RED_FLAG.test(relevant)
      || (HIGH_FEVER.test(relevant) && NEURO_OR_VISION.test(relevant))
      || (SEVERE_MODIFIER.test(relevant) && SERIOUS_SYMPTOM.test(relevant))));
  if (redFlag) return { intent: "emergency", symptoms: symptoms || current, reason: "red_flag" };
  if (FLOW_REQUEST.test(current)) return { intent: "flow", symptoms, reason: "service_request" };
  if (TRANSLATION_REQUEST.test(current)) return { intent: "translation", symptoms, reason: "service_request" };
  if (COMPANION_REQUEST.test(current)) return { intent: "companion", symptoms, reason: "service_request" };
  if (asksForHospital) return { intent: "hospital", symptoms, reason: "hospital_request" };
  if (asksForKnowledge) return { intent: "education", symptoms: "", reason: "education_request" };
  if (currentHasSymptoms) return { intent: "hospital", symptoms: symptoms || current, reason: "symptoms" };
  return { intent: "general", symptoms, reason: "none" };
}
