const CSV_URL = '../words/grec_francais_ankidroid.csv';
const STORAGE_KEY = 'greek-cards-side-mode';
const elements = {
  mode: document.querySelector('#side-mode'),
  orderMode: document.querySelector('#order-mode'),
  card: document.querySelector('#flashcard'),
  inner: document.querySelector('#card-inner'),
  greek: document.querySelector('#greek-word'),
  pronunciation: document.querySelector('#pronunciation'),
  french: document.querySelector('#french-word'),
  frontLabel: document.querySelector('#front-label'),
  backLabel: document.querySelector('#back-label'),
  sideCaption: document.querySelector('#side-caption'),
  number: document.querySelector('#card-number'),
  total: document.querySelector('#card-total'),
  wordCount: document.querySelector('#word-count'),
  counter: document.querySelector('.counter'),
  controls: document.querySelector('.card-controls'),
  nextLabel: document.querySelector('#next-label'),
  error: document.querySelector('#load-error'),
  previous: document.querySelector('#previous'),
  next: document.querySelector('#next'),
};

let words = [];
let allOrder = [];
let allPosition = 0;
let randomWordIndex = 0;
let displayedWordIndex = 0;
let shownSide = 'recto';
let swipeStart = null;
let suppressCardClickUntil = 0;

function parseCsvLine(line) {
  const fields = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === ';' && !inQuotes) {
      fields.push(value.trim());
      value = '';
    } else {
      value += character;
    }
  }
  fields.push(value.trim());
  return fields;
}

function parseCsv(csv) {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines.shift()).map((header) => header.toLocaleLowerCase('fr'));
  const greekColumn = headers.indexOf('grec');
  const pronunciationColumn = headers.indexOf('prononciation');
  const englishColumn = headers.indexOf('english') >= 0 ? headers.indexOf('english') : headers.indexOf('français');
  if ([greekColumn, pronunciationColumn, englishColumn].some((column) => column < 0)) {
    throw new Error('The CSV must have Grec, Prononciation and English columns.');
  }

  return lines.map(parseCsvLine).map((fields) => ({
    greek: fields[greekColumn] || '',
    pronunciation: fields[pronunciationColumn] || '',
    french: fields[englishColumn] || '',
  })).filter((word) => word.greek && word.french);
}

function chooseStartingSide() {
  if (elements.mode.value === 'random') {
    return Math.random() < 0.5 ? 'recto' : 'verso';
  }
  return elements.mode.value;
}

function shuffle(values) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    [values[index], values[otherIndex]] = [values[otherIndex], values[index]];
  }
  return values;
}

function currentWordIndex() {
  return elements.orderMode.value === 'random'
    ? randomWordIndex
    : allOrder[allPosition];
}

function renderCard() {
  const wordIndex = currentWordIndex();
  const word = words[wordIndex];
  if (!word) return;

  displayedWordIndex = wordIndex;
  shownSide = chooseStartingSide();
  elements.greek.textContent = word.greek;
  elements.pronunciation.textContent = word.pronunciation;
  elements.pronunciation.hidden = !word.pronunciation;
  elements.french.textContent = word.french;
  elements.inner.getAnimations().forEach((animation) => animation.cancel());
  elements.inner.classList.toggle('is-flipped', shownSide === 'verso');
  elements.sideCaption.textContent = shownSide === 'recto' ? 'Grec affiché' : 'Anglais affiché';
  const isRandomMode = elements.orderMode.value === 'random';
  elements.number.textContent = String(allPosition + 1);
  elements.total.textContent = String(words.length);
  elements.counter.hidden = isRandomMode;
  elements.previous.hidden = isRandomMode;
  elements.controls.classList.toggle('random-mode', isRandomMode);
  elements.nextLabel.hidden = !isRandomMode;
  elements.card.setAttribute('aria-label', `${word.greek}, ${word.french}. Toucher pour retourner la carte.`);
}

function moveCard(direction) {
  if (elements.orderMode.value === 'random') {
    if (direction < 0) return;
    randomWordIndex = Math.floor(Math.random() * words.length);
  } else if (direction < 0) {
    allPosition = (allPosition - 1 + allOrder.length) % allOrder.length;
  } else if (allPosition === allOrder.length - 1) {
    const previousWordIndex = currentWordIndex();
    allOrder = shuffle(words.map((_, index) => index));
    if (allOrder.length > 1 && allOrder[0] === previousWordIndex) {
      const swapIndex = 1 + Math.floor(Math.random() * (allOrder.length - 1));
      [allOrder[0], allOrder[swapIndex]] = [allOrder[swapIndex], allOrder[0]];
    }
    allPosition = 0;
  } else {
    allPosition += 1;
  }
  renderCard();
}

elements.card.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'mouse') return;
  swipeStart = { x: event.clientX, y: event.clientY };
  elements.card.setPointerCapture(event.pointerId);
});

elements.card.addEventListener('pointerup', (event) => {
  if (!swipeStart) return;
  const deltaX = event.clientX - swipeStart.x;
  const deltaY = event.clientY - swipeStart.y;
  swipeStart = null;

  if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
  suppressCardClickUntil = Date.now() + 500;
  if (elements.orderMode.value === 'random') {
    moveCard(1);
  } else {
    moveCard(deltaX < 0 ? 1 : -1);
  }
});

elements.card.addEventListener('pointercancel', () => {
  swipeStart = null;
});

elements.card.addEventListener('click', (event) => {
  if (Date.now() < suppressCardClickUntil) {
    event.preventDefault();
    return;
  }
  if (!words.length) return;
  const fromTransform = getComputedStyle(elements.inner).transform;
  elements.inner.getAnimations().forEach((animation) => animation.cancel());
  elements.inner.classList.toggle('is-flipped');
  shownSide = shownSide === 'recto' ? 'verso' : 'recto';
  const toTransform = shownSide === 'recto' ? 'rotateY(0deg)' : 'rotateY(180deg)';
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    elements.inner.animate(
      [{ transform: fromTransform }, { transform: toTransform }],
      { duration: 650, easing: 'cubic-bezier(.2,.72,.22,1)' },
    );
  }
  elements.sideCaption.textContent = shownSide === 'recto' ? 'Grec affiché' : 'Anglais affiché';
});

elements.previous.addEventListener('click', () => moveCard(-1));
elements.next.addEventListener('click', () => moveCard(1));
elements.orderMode.addEventListener('change', () => {
  if (elements.orderMode.value === 'random') {
    randomWordIndex = displayedWordIndex;
  } else {
    allOrder = [displayedWordIndex, ...shuffle(words.map((_, index) => index).filter((index) => index !== displayedWordIndex))];
    allPosition = 0;
  }
  renderCard();
});
elements.mode.addEventListener('change', () => {
  localStorage.setItem(STORAGE_KEY, elements.mode.value);
  renderCard();
});

document.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.target instanceof HTMLSelectElement) return;
  if (event.key === 'ArrowLeft') moveCard(-1);
  if (event.key === 'ArrowRight') moveCard(1);
  if (event.key === ' ' && !(event.target instanceof HTMLButtonElement)) {
    event.preventDefault();
    elements.card.click();
  }
});

async function loadWords() {
  try {
    const response = await fetch(CSV_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Le fichier de mots est introuvable (${response.status}).`);
    words = parseCsv(await response.text());
    if (!words.length) throw new Error('Aucun mot trouvé dans le fichier CSV.');

    const savedMode = localStorage.getItem(STORAGE_KEY);
    if (['random', 'recto', 'verso'].includes(savedMode)) elements.mode.value = savedMode;
    elements.orderMode.value = 'all';
    allOrder = shuffle(words.map((_, index) => index));
    elements.total.textContent = String(words.length);
    elements.wordCount.textContent = `${words.length} mots`;
    renderCard();
  } catch (error) {
    if (location.protocol === 'file:') {
      elements.error.textContent = 'Le site est ouvert comme fichier local. Le navigateur bloque le chargement du CSV : ouvrez le site publié sur GitHub Pages ou lancez un serveur local depuis la racine du dépôt (python3 -m http.server 8000), puis ouvrez http://localhost:8000/app/. ';
    } else {
      const csvUrl = new URL(CSV_URL, location.href);
      elements.error.textContent = `${error.message} Impossible de charger ${csvUrl.pathname}. Vérifiez que le fichier words/grec_francais_ankidroid.csv est publié à côté du site.`;
    }
    elements.error.hidden = false;
    elements.wordCount.textContent = 'Mots indisponibles';
  }
}

loadWords();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}
