// Read-aloud with the browser's own speech synthesis. No service, no key, nothing leaves the phone.
// Many farmers read slowly or not at all; a Listen button on every answer is the cheapest fix.
(function () {
  const synth = window.speechSynthesis;
  const LOCALES = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN', ta: 'ta-IN', ml: 'ml-IN', kn: 'kn-IN' };
  const NAMES = { en: 'English', hi: 'Hindi', te: 'Telugu', ta: 'Tamil', ml: 'Malayalam', kn: 'Kannada' };
  let speaking = null;

  // Voices load asynchronously in Chrome; ask once so they are ready by the first click.
  if (synth) { synth.getVoices(); synth.onvoiceschanged = () => synth.getVoices(); }

  function voiceFor(lang) {
    const voices = synth.getVoices();
    const locale = LOCALES[lang] || 'en-IN';
    return voices.find(v => v.lang.replace('_', '-') === locale)
        || voices.find(v => v.lang.toLowerCase().startsWith(lang));
  }

  function clean(text) {
    // Emoji and arrows are read out as their names ("right arrow"); drop them.
    return text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}→←↑↓•·]/gu, ' ').replace(/\s+/g, ' ').trim();
  }

  function stop() {
    synth.cancel();
    if (speaking) { speaking.textContent = '🔊 Listen'; speaking.setAttribute('aria-pressed', 'false'); }
    speaking = null;
  }

  function speak(button, text, lang, note) {
    if (speaking === button) { stop(); return; }
    stop();
    const utterance = new SpeechSynthesisUtterance(clean(text));
    const voice = voiceFor(lang);
    utterance.lang = LOCALES[lang] || 'en-IN';
    if (voice) utterance.voice = voice;
    if (note) {
      note.hidden = !!voice || lang === 'en';
      note.textContent = voice ? '' :
        `This device has no ${NAMES[lang] || lang} voice, so it may read in English or stay silent. ` +
        `Add one in your phone's text-to-speech settings.`;
    }
    utterance.onend = utterance.onerror = () => { if (speaking === button) stop(); };
    speaking = button;
    button.textContent = '⏹ Stop';
    button.setAttribute('aria-pressed', 'true');
    synth.speak(utterance);
  }

  // A Listen button that reads getText() in getLang(). Returns null when the browser cannot speak.
  window.listenButton = function (getText, getLang) {
    if (!synth || !window.SpeechSynthesisUtterance) return null;
    const wrap = document.createElement('span');
    wrap.className = 'listen';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'listen-btn';
    button.textContent = '🔊 Listen';
    button.setAttribute('aria-pressed', 'false');
    const note = document.createElement('span');
    note.className = 'listen-note';
    note.hidden = true;
    button.addEventListener('click', () => speak(button, getText(), (getLang && getLang()) || 'en', note));
    wrap.append(button, note);
    return wrap;
  };

  window.addEventListener('pagehide', () => synth && synth.cancel());
})();
