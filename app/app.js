const CSV_URL = '../words/grec_francais_ankidroid.csv';
const STORAGE_KEY = 'greek-cards-side-mode';
const ui = Object.fromEntries(Object.entries({
  sideMode: '#side-mode', orderMode: '#order-mode', slider: '#flashcard-swiper',
  wrapper: '#card-slides', caption: '#side-caption', number: '#card-number',
  total: '#card-total', count: '#word-count', counter: '.counter',
  controls: '.card-controls', nextLabel: '#next-label', error: '#load-error',
  previous: '#previous', next: '#next',
}).map(([key, selector]) => [key, document.querySelector(selector)]));

let words = [];
let swiper;
let rebuilding = false;

function csvFields(line) {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { field += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === ';' && !quoted) {
      fields.push(field.trim());
      field = '';
    } else field += char;
  }
  fields.push(field.trim());
  return fields;
}

function parseWords(csv) {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  const headers = csvFields(lines.shift() || '').map((header) => header.toLowerCase());
  const columns = ['grec', 'prononciation', 'english'].map((name) => headers.indexOf(name));
  if (columns.includes(-1)) throw new Error('Colonnes Grec, Prononciation et English attendues dans le CSV.');
  return lines.map((line) => {
    const fields = csvFields(line);
    return { greek: fields[columns[0]], pronunciation: fields[columns[1]], english: fields[columns[2]] };
  }).filter((word) => word.greek && word.english);
}

function randomIndex() { return Math.floor(Math.random() * words.length); }
function shuffle(indices) {
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}
function startingSide() {
  return ui.sideMode.value === 'random'
    ? (Math.random() < 0.5 ? 'recto' : 'verso')
    : ui.sideMode.value;
}
function node(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function face(label, mainClass, text) {
  const element = node('span', `card-face ${mainClass === 'greek-word' ? 'card-front' : 'card-back'}`);
  const word = node('span', mainClass, text);
  word.lang = mainClass === 'greek-word' ? 'el' : 'en';
  element.append(node('span', 'face-label', label), word);
  return element;
}
function slide(wordIndex, side = startingSide()) {
  const word = words[wordIndex];
  const element = node('div', 'swiper-slide');
  element.dataset.word = String(wordIndex);
  element.dataset.side = side;
  const card = node('button', 'flashcard');
  card.type = 'button';
  card.setAttribute('aria-label', 'Retourner la carte');
  const inner = node('span', `card-inner${side === 'verso' ? ' is-flipped' : ''}`);
  const front = face('Grec · recto', 'greek-word', word.greek);
  if (word.pronunciation) front.append(node('span', 'pronunciation', word.pronunciation));
  const back = face('Anglais · verso', 'english-word', word.english);
  for (const sideFace of [front, back]) sideFace.append(node('span', 'tap-hint', '↻  Toucher pour retourner'));
  inner.append(front, back);
  card.append(inner);
  element.append(card);
  return element;
}

function activeSlide() { return swiper?.slides[swiper.activeIndex]; }
function updateDisplay() {
  const active = activeSlide();
  if (!active) return;
  const random = ui.orderMode.value === 'random';
  ui.caption.textContent = active.dataset.side === 'verso' ? 'Anglais affiché' : 'Grec affiché';
  ui.number.textContent = String(swiper.activeIndex + 1);
  ui.total.textContent = String(words.length);
  ui.counter.hidden = random;
  ui.previous.hidden = random;
  ui.nextLabel.hidden = !random;
  ui.controls.classList.toggle('random-mode', random);
}
function showSlides(slides, index = 0) {
  rebuilding = true;
  ui.wrapper.replaceChildren(...slides);
  if (swiper) {
    swiper.update();
    swiper.slideTo(index, 0, false);
  } else {
    swiper = new Swiper(ui.slider, {
      initialSlide: index, speed: 420, rewind: true, preventInteractionOnTransition: true,
      on: {
        slideChange() { if (!rebuilding) updateDisplay(); },
        slideChangeTransitionEnd() {
          if (rebuilding) return;
          const active = activeSlide();
          if (ui.orderMode.value === 'random') {
            showSlides([slide(randomIndex()), slide(Number(active.dataset.word), active.dataset.side), slide(randomIndex())], 1);
          } else {
            const previous = swiper.slides[swiper.previousIndex];
            if (previous && previous !== active) {
              previous.dataset.side = startingSide();
              previous.querySelector('.card-inner').classList.toggle('is-flipped', previous.dataset.side === 'verso');
            }
            if (swiper.activeIndex === 0 && swiper.previousIndex === words.length - 1) {
              const remaining = shuffle(Array.from(swiper.slides).slice(1).map((item) => Number(item.dataset.word)));
              showSlides([active, ...remaining.map((word) => slide(word))]);
            }
          }
        },
      },
    });
  }
  updateDisplay();
  rebuilding = false;
}
function startMode(currentWord = null, currentSide = null) {
  if (ui.orderMode.value === 'random') {
    const middle = currentWord ?? randomIndex();
    showSlides([slide(randomIndex()), slide(middle, currentSide || startingSide()), slide(randomIndex())], 1);
  } else {
    const indices = shuffle(words.map((_, index) => index));
    if (currentWord !== null) indices.unshift(indices.splice(indices.indexOf(currentWord), 1)[0]);
    showSlides(indices.map((index) => slide(index, index === currentWord ? currentSide || startingSide() : startingSide())));
  }
}

ui.slider.addEventListener('click', (event) => {
  const card = event.target.closest('.flashcard');
  const active = activeSlide();
  if (!card || !active?.contains(card)) return;
  active.dataset.side = active.dataset.side === 'recto' ? 'verso' : 'recto';
  card.querySelector('.card-inner').classList.toggle('is-flipped', active.dataset.side === 'verso');
  updateDisplay();
});
ui.previous.addEventListener('click', () => swiper?.slidePrev());
ui.next.addEventListener('click', () => swiper?.slideNext());
ui.orderMode.addEventListener('change', () => {
  if (!words.length) return;
  const active = activeSlide();
  startMode(Number(active.dataset.word), active.dataset.side);
});
ui.sideMode.addEventListener('change', () => {
  localStorage.setItem(STORAGE_KEY, ui.sideMode.value);
  if (!swiper) return;
  swiper.slides.forEach((item) => {
    item.dataset.side = startingSide();
    item.querySelector('.card-inner').classList.toggle('is-flipped', item.dataset.side === 'verso');
  });
  updateDisplay();
});
document.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName)) return;
  if (event.key === 'ArrowLeft') {
    if (ui.orderMode.value === 'random') swiper?.slideNext();
    else swiper?.slidePrev();
  }
  if (event.key === 'ArrowRight') swiper?.slideNext();
  if (event.key === ' ' && !(event.target instanceof HTMLButtonElement)) {
    event.preventDefault();
    activeSlide()?.querySelector('.flashcard').click();
  }
});

async function loadWords() {
  try {
    const response = await fetch(CSV_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Fichier de mots introuvable (${response.status}).`);
    words = parseWords(await response.text());
    if (!words.length) throw new Error('Aucun mot trouvé dans le CSV.');
    const savedSide = localStorage.getItem(STORAGE_KEY);
    if (['random', 'recto', 'verso'].includes(savedSide)) ui.sideMode.value = savedSide;
    ui.count.textContent = `${words.length} mots`;
    startMode();
  } catch (error) {
    ui.error.textContent = location.protocol === 'file:'
      ? 'Ouvrez le site publié ou lancez un serveur local depuis la racine du dépôt : python3 -m http.server 8000.'
      : `${error.message} Vérifiez que words/grec_francais_ankidroid.csv est publié.`;
    ui.error.hidden = false;
    ui.count.textContent = 'Mots indisponibles';
  }
}
loadWords();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}
