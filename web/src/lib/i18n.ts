// Interface labels in six languages. Answers from KrishiMitra and Crop Doctor already come back in
// the chosen language from the server; these cover navigation, buttons and headings. Anything not
// listed falls back to English rather than showing a key.

export const LANGUAGES = [
  { code: 'en', label: 'English', speech: 'en-IN' },
  { code: 'hi', label: 'हिंदी', speech: 'hi-IN' },
  { code: 'te', label: 'తెలుగు', speech: 'te-IN' },
  { code: 'ta', label: 'தமிழ்', speech: 'ta-IN' },
  { code: 'ml', label: 'മലയാളം', speech: 'ml-IN' },
  { code: 'kn', label: 'ಕನ್ನಡ', speech: 'kn-IN' },
] as const

export type Lang = (typeof LANGUAGES)[number]['code']

type Entry = Record<Lang, string>

const D = {
  'nav.home': { en: 'Home', hi: 'होम', te: 'హోమ్', ta: 'முகப்பு', ml: 'ഹോം', kn: 'ಮುಖಪುಟ' },
  'nav.grow': { en: 'Grow', hi: 'फसल', te: 'పంట', ta: 'பயிர்', ml: 'വിള', kn: 'ಬೆಳೆ' },
  'nav.doctor': { en: 'Doctor', hi: 'डॉक्टर', te: 'వైద్యుడు', ta: 'மருத்துவர்', ml: 'ഡോക്ടർ', kn: 'ವೈದ್ಯ' },
  'nav.ask': { en: 'Ask', hi: 'पूछें', te: 'అడగండి', ta: 'கேள்வி', ml: 'ചോദിക്കൂ', kn: 'ಪ್ರಶ್ನೆ' },
  'nav.more': { en: 'More', hi: 'और', te: 'మరిన్ని', ta: 'மேலும்', ml: 'കൂടുതൽ', kn: 'ಇನ್ನಷ್ಟು' },
  'home.title': {
    en: 'What do you want to do today?',
    hi: 'आज आप क्या करना चाहते हैं?',
    te: 'ఈరోజు మీరు ఏమి చేయాలనుకుంటున్నారు?',
    ta: 'இன்று நீங்கள் என்ன செய்ய விரும்புகிறீர்கள்?',
    ml: 'ഇന്ന് നിങ്ങൾ എന്താണ് ചെയ്യാൻ ആഗ്രഹിക്കുന്നത്?',
    kn: 'ಇಂದು ನೀವು ಏನು ಮಾಡಲು ಬಯಸುತ್ತೀರಿ?',
  },
  'home.ask': {
    en: 'Ask anything about your farm…',
    hi: 'अपनी खेती के बारे में कुछ भी पूछें…',
    te: 'మీ వ్యవసాయం గురించి ఏదైనా అడగండి…',
    ta: 'உங்கள் விவசாயம் பற்றி எதையும் கேளுங்கள்…',
    ml: 'നിങ്ങളുടെ കൃഷിയെക്കുറിച്ച് എന്തും ചോദിക്കൂ…',
    kn: 'ನಿಮ್ಮ ಕೃಷಿಯ ಬಗ್ಗೆ ಏನನ್ನಾದರೂ ಕೇಳಿ…',
  },
  'tile.grow': { en: 'What to grow', hi: 'क्या उगाएं', te: 'ఏమి పండించాలి', ta: 'என்ன பயிரிடலாம்', ml: 'എന്ത് കൃഷി ചെയ്യണം', kn: 'ಏನು ಬೆಳೆಯಬೇಕು' },
  'tile.doctor': {
    en: 'Check a sick plant',
    hi: 'बीमार पौधा जांचें',
    te: 'జబ్బు మొక్కను చూపండి',
    ta: 'நோயுற்ற செடியைச் சோதிக்கவும்',
    ml: 'രോഗമുള്ള ചെടി പരിശോധിക്കൂ',
    kn: 'ರೋಗದ ಗಿಡ ಪರೀಕ್ಷಿಸಿ',
  },
  'tile.sell': { en: 'Where to sell', hi: 'कहां बेचें', te: 'ఎక్కడ అమ్మాలి', ta: 'எங்கே விற்கலாம்', ml: 'എവിടെ വിൽക്കണം', kn: 'ಎಲ್ಲಿ ಮಾರಬೇಕು' },
  'tile.plan': { en: 'My season plan', hi: 'मेरी सीज़न योजना', te: 'నా సీజన్ ప్రణాళిక', ta: 'என் பருவத் திட்டம்', ml: 'എന്റെ സീസൺ പ്ലാൻ', kn: 'ನನ್ನ ಋತು ಯೋಜನೆ' },
  'home.note': {
    en: 'Speak or type in your language · answers cite their source',
    hi: 'अपनी भाषा में बोलें या लिखें · हर जवाब में स्रोत दिखता है',
    te: 'మీ భాషలో మాట్లాడండి లేదా టైప్ చేయండి · ప్రతి సమాధానానికి మూలం ఉంటుంది',
    ta: 'உங்கள் மொழியில் பேசுங்கள் அல்லது தட்டச்சு செய்யுங்கள் · ஒவ்வொரு பதிலுக்கும் ஆதாரம் உண்டு',
    ml: 'നിങ്ങളുടെ ഭാഷയിൽ സംസാരിക്കൂ അല്ലെങ്കിൽ ടൈപ്പ് ചെയ്യൂ · ഓരോ ഉത്തരത്തിനും ഉറവിടം ഉണ്ട്',
    kn: 'ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ಮಾತನಾಡಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ · ಪ್ರತಿ ಉತ್ತರಕ್ಕೂ ಮೂಲ ಇದೆ',
  },
  'hint.grow': { en: 'Soil + weather', hi: 'मिट्टी + मौसम', te: 'నేల + వాతావరణం', ta: 'மண் + வானிலை', ml: 'മണ്ണ് + കാലാവസ്ഥ', kn: 'ಮಣ್ಣು + ಹವಾಮಾನ' },
  'hint.doctor': { en: 'Take a photo', hi: 'फ़ोटो लें', te: 'ఫోటో తీయండి', ta: 'புகைப்படம் எடுக்கவும்', ml: 'ഫോട്ടോ എടുക്കൂ', kn: 'ಫೋಟೋ ತೆಗೆಯಿರಿ' },
  'hint.sell': { en: 'Best mandi', hi: 'सबसे अच्छी मंडी', te: 'ఉత్తమ మండి', ta: 'சிறந்த மண்டி', ml: 'മികച്ച മണ്ഡി', kn: 'ಉತ್ತಮ ಮಂಡಿ' },
  'hint.plan': { en: 'Dates, bags, ₹', hi: 'तारीखें, बोरियां, ₹', te: 'తేదీలు, బస్తాలు, ₹', ta: 'தேதிகள், மூட்டைகள், ₹', ml: 'തീയതികൾ, ചാക്കുകൾ, ₹', kn: 'ದಿನಾಂಕಗಳು, ಚೀಲಗಳು, ₹' },
  'tile.yield': { en: 'Yield forecast', hi: 'उपज का अनुमान', te: 'దిగుబడి అంచనా', ta: 'விளைச்சல் கணிப்பு', ml: 'വിളവ് പ്രവചനം', kn: 'ಇಳುವರಿ ಮುನ್ಸೂಚನೆ' },
  'tile.schemes': { en: 'Kisan Yojana', hi: 'किसान योजना', te: 'కిసాన్ యోజన', ta: 'கிசான் யோஜனா', ml: 'കിസാൻ യോജന', kn: 'ಕಿಸಾನ್ ಯೋಜನೆ' },
  'tile.community': { en: 'Official channels', hi: 'सरकारी चैनल', te: 'అధికారిక ఛానెల్‌లు', ta: 'அதிகாரப்பூர்வ சேனல்கள்', ml: 'ഔദ്യോഗിക ചാനലുകൾ', kn: 'ಅಧಿಕೃತ ಚಾನೆಲ್‌ಗಳು' },
  'hint.yield': { en: 'Quintal per acre', hi: 'क्विंटल प्रति एकड़', te: 'ఎకరానికి క్వింటాళ్లు', ta: 'ஏக்கருக்கு குவிண்டால்', ml: 'ഏക്കറിന് ക്വിന്റൽ', kn: 'ಎಕರೆಗೆ ಕ್ವಿಂಟಾಲ್' },
  'hint.schemes': { en: 'Schemes + updates', hi: 'योजनाएं + ताज़ा खबर', te: 'పథకాలు + తాజా వార్తలు', ta: 'திட்டங்கள் + புதியவை', ml: 'പദ്ധതികൾ + പുതിയവ', kn: 'ಯೋಜನೆಗಳು + ಹೊಸ ಸುದ್ದಿ' },
  'hint.community': { en: 'WhatsApp, Telegram', hi: 'व्हाट्सऐप, टेलीग्राम', te: 'వాట్సాప్, టెలిగ్రామ్', ta: 'வாட்ஸ்அப், டெலிகிராம்', ml: 'വാട്ട്‌സ്ആപ്പ്, ടെലിഗ്രാം', kn: 'ವಾಟ್ಸಾಪ್, ಟೆಲಿಗ್ರಾಮ್' },
  'greet.morning': { en: 'Good morning', hi: 'सुप्रभात', te: 'శుభోదయం', ta: 'காலை வணக்கம்', ml: 'സുപ്രഭാതം', kn: 'ಶುಭೋದಯ' },
  'greet.afternoon': { en: 'Good afternoon', hi: 'नमस्कार', te: 'శుభ మధ్యాహ్నం', ta: 'மதிய வணக்கம்', ml: 'നമസ്കാരം', kn: 'ಶುಭ ಮಧ್ಯಾಹ್ನ' },
  'greet.evening': { en: 'Good evening', hi: 'शुभ संध्या', te: 'శుభ సాయంత్రం', ta: 'மாலை வணக்கம்', ml: 'ശുഭ സായാഹ്നം', kn: 'ಶುಭ ಸಂಜೆ' },
  'home.tools': { en: 'What can CropWise do for you?', hi: 'CropWise आपके लिए क्या कर सकता है?', te: 'CropWise మీ కోసం ఏమి చేయగలదు?', ta: 'CropWise உங்களுக்கு என்ன செய்யும்?', ml: 'CropWise നിങ്ങൾക്കായി എന്തു ചെയ്യും?', kn: 'CropWise ನಿಮಗಾಗಿ ಏನು ಮಾಡಬಹುದು?' },
  'home.now': { en: 'Right now in', hi: 'अभी', te: 'ఇప్పుడు', ta: 'இப்போது', ml: 'ഇപ്പോൾ', kn: 'ಈಗ' },
  'common.listen': { en: 'Listen', hi: 'सुनें', te: 'వినండి', ta: 'ஒலியாகக் கேட்க', ml: 'കേൾക്കൂ', kn: 'ಆಲಿಸಿ' },
  'common.stop': { en: 'Stop', hi: 'रोकें', te: 'ఆపండి', ta: 'நிறுத்து', ml: 'നിർത്തൂ', kn: 'ನಿಲ್ಲಿಸಿ' },
  'common.speak': { en: 'Speak', hi: 'बोलें', te: 'మాట్లాడండి', ta: 'பேசுங்கள்', ml: 'സംസാരിക്കൂ', kn: 'ಮಾತನಾಡಿ' },
  'common.send': { en: 'Send', hi: 'भेजें', te: 'పంపండి', ta: 'அனுப்பு', ml: 'അയയ്ക്കൂ', kn: 'ಕಳುಹಿಸಿ' },
  'common.continue': { en: 'Continue', hi: 'आगे बढ़ें', te: 'కొనసాగించండి', ta: 'தொடரவும்', ml: 'തുടരുക', kn: 'ಮುಂದುವರಿಸಿ' },
  'common.retry': { en: 'Try again', hi: 'फिर कोशिश करें', te: 'మళ్లీ ప్రయత్నించండి', ta: 'மீண்டும் முயற்சிக்கவும்', ml: 'വീണ്ടും ശ്രമിക്കുക', kn: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ' },
  'common.loading': { en: 'Loading…', hi: 'लोड हो रहा है…', te: 'లోడ్ అవుతోంది…', ta: 'ஏற்றுகிறது…', ml: 'ലോഡ് ചെയ്യുന്നു…', kn: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ…' },
  'common.sample': { en: 'Sample data', hi: 'नमूना डेटा', te: 'నమూనా డేటా', ta: 'மாதிரித் தரவு', ml: 'സാമ്പിൾ ഡാറ്റ', kn: 'ಮಾದರಿ ಡೇಟಾ' },
  'common.estimate': { en: 'Estimate', hi: 'अनुमान', te: 'అంచనా', ta: 'மதிப்பீடு', ml: 'ഏകദേശ കണക്ക്', kn: 'ಅಂದಾಜು' },
  'common.source': { en: 'Source', hi: 'स्रोत', te: 'మూలం', ta: 'ஆதாரம்', ml: 'ഉറവിടം', kn: 'ಮೂಲ' },
  'help.call': {
    en: 'Talk to a person — Kisan Call Centre',
    hi: 'किसी व्यक्ति से बात करें — किसान कॉल सेंटर',
    te: 'ఒక వ్యక్తితో మాట్లాడండి — కిసాన్ కాల్ సెంటర్',
    ta: 'ஒருவரிடம் பேசுங்கள் — கிசான் அழைப்பு மையம்',
    ml: 'ഒരാളോട് സംസാരിക്കൂ — കിസാൻ കോൾ സെന്റർ',
    kn: 'ವ್ಯಕ್ತಿಯೊಂದಿಗೆ ಮಾತನಾಡಿ — ಕಿಸಾನ್ ಕಾಲ್ ಸೆಂಟರ್',
  },
  'grow.title': { en: 'Where is your farm?', hi: 'आपका खेत कहां है?', te: 'మీ పొలం ఎక్కడ ఉంది?', ta: 'உங்கள் வயல் எங்கே உள்ளது?', ml: 'നിങ്ങളുടെ കൃഷിയിടം എവിടെയാണ്?', kn: 'ನಿಮ್ಮ ಹೊಲ ಎಲ್ಲಿದೆ?' },
  'grow.town': { en: 'Town or village', hi: 'शहर या गांव', te: 'పట్టణం లేదా గ్రామం', ta: 'நகரம் அல்லது கிராமம்', ml: 'പട്ടണം അല്ലെങ്കിൽ ഗ്രാമം', kn: 'ಪಟ್ಟಣ ಅಥವಾ ಹಳ್ಳಿ' },
  'grow.detect': {
    en: 'Read my soil and weather',
    hi: 'मेरी मिट्टी और मौसम देखें',
    te: 'నా నేల మరియు వాతావరణం చూడండి',
    ta: 'என் மண் மற்றும் வானிலையைப் பார்',
    ml: 'എന്റെ മണ്ണും കാലാവസ്ഥയും നോക്കൂ',
    kn: 'ನನ್ನ ಮಣ್ಣು ಮತ್ತು ಹವಾಮಾನ ನೋಡಿ',
  },
  'grow.recommend': {
    en: 'Show the best crops',
    hi: 'सबसे अच्छी फसलें दिखाएं',
    te: 'ఉత్తమ పంటలు చూపించు',
    ta: 'சிறந்த பயிர்களைக் காட்டு',
    ml: 'മികച്ച വിളകൾ കാണിക്കൂ',
    kn: 'ಉತ್ತಮ ಬೆಳೆಗಳನ್ನು ತೋರಿಸಿ',
  },
  'results.title': {
    en: 'Best crops for your farm',
    hi: 'आपके खेत के लिए सबसे अच्छी फसलें',
    te: 'మీ పొలానికి ఉత్తమ పంటలు',
    ta: 'உங்கள் வயலுக்கு சிறந்த பயிர்கள்',
    ml: 'നിങ്ങളുടെ കൃഷിയിടത്തിന് മികച്ച വിളകൾ',
    kn: 'ನಿಮ್ಮ ಹೊಲಕ್ಕೆ ಉತ್ತಮ ಬೆಳೆಗಳು',
  },
  'results.plan': { en: 'See season plan', hi: 'सीज़न योजना देखें', te: 'సీజన్ ప్రణాళిక చూడండి', ta: 'பருவத் திட்டத்தைப் பார்', ml: 'സീസൺ പ്ലാൻ കാണൂ', kn: 'ಋತು ಯೋಜನೆ ನೋಡಿ' },
  'settings.language': { en: 'Language', hi: 'भाषा', te: 'భాష', ta: 'மொழி', ml: 'ഭാഷ', kn: 'ಭಾಷೆ' },
  'settings.theme': { en: 'Theme', hi: 'थीम', te: 'థీమ్', ta: 'தீம்', ml: 'തീം', kn: 'ಥೀಮ್' },
  offline: {
    en: 'You are offline — showing what was saved on this phone.',
    hi: 'आप ऑफ़लाइन हैं — इस फ़ोन पर सहेजी जानकारी दिख रही है।',
    te: 'మీరు ఆఫ్‌లైన్‌లో ఉన్నారు — ఈ ఫోన్‌లో సేవ్ చేసినది చూపిస్తున్నాం.',
    ta: 'நீங்கள் ஆஃப்லைனில் உள்ளீர்கள் — இந்த போனில் சேமித்ததைக் காட்டுகிறோம்.',
    ml: 'നിങ്ങൾ ഓഫ്‌ലൈനിലാണ് — ഈ ഫോണിൽ സേവ് ചെയ്തത് കാണിക്കുന്നു.',
    kn: 'ನೀವು ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿದ್ದೀರಿ — ಈ ಫೋನ್‌ನಲ್ಲಿ ಉಳಿಸಿದ್ದನ್ನು ತೋರಿಸುತ್ತಿದ್ದೇವೆ.',
  },
} satisfies Record<string, Entry>

export type Key = keyof typeof D

export function translate(lang: Lang, key: Key): string {
  const entry: Entry = D[key]
  return entry[lang] || entry.en
}

export function speechLocale(lang: Lang): string {
  return LANGUAGES.find((l) => l.code === lang)?.speech ?? 'en-IN'
}
