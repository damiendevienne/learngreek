const CSV_URL = '../words/grec_francais_ankidroid.csv';
const STORAGE_KEY = 'greek-cards-side-mode';
const RANDOM_LOOKAHEAD = 5;

const elements = {
  mode: document.querySelector('#side-mode'),
  orderMode: document.querySelector('#order-mode'),
  slider: document.querySelector('#flashcard-swiper'),
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
let displayedWordIndex = 0;
let shownSide = 'recto';
let swiper;
let rebuildingSlides = false;

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
    english: fields[englishColumn] || '',
  })).filter((word) => word.greek && word.english);
}

function chooseStartingSide() {
  if (elements.mode.value === 'random') return Math.random() < 0.5 ? 'recto' : 'verso';
  return elements.mode.value;
}

function shuffle(values) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    [values[index], values[otherIndex]] = [values[otherIndex], values[index]];
  }
  return values;
}

function randomWordIndex() {
  return Math.floor(Math.random() * words.length);
}

function createSpan(className, text, lang) {
  const span = document.createElement('span');
  span.className = className;
  if (text !== undefined) span.textContent = text;
  if (lang) span.lang = lang;
  return span;
}

function createTapHint() {
  const hint = createSpan('tap-hint');
  const icon = createSpan('', '↻');
  icon.setAttribute('aria-hidden', 'true');
  hint.append(icon, document.createTextNode(' Toucher pour retourner'));
  return hint;
}

function createSlide(wordIndex) {
  const word = words[wordIndex];
  const slide = document.createElement('div');
  slide.className = 'swiper-slide';
  slide.dataset.wordIndex = String(wordIndex);

  const card = document.createElement('button');
  card.className = 'flashcard';
  card.type = 'button';
  card.setAttribute('aria-label', `${word.greek}, ${word.english}. Touch to flip the card.`);

  const inner = createSpan('card-inner');
  const front = createSpan('card-face card-front');
  front.append(
    createSpan('face-label', 'Grec · recto'),
    createSpan('greek-word', word.greek, 'el'),
  );
  const pronunciation = createSpan('pronunciation', word.pronunciation);
  pronunciation.hidden = !word.pronunciation;
  front.append(pronunciation, createTapHint());

  const back = createSpan('card-face card-back');
  back.append(
    createSpan('face-label', 'Anglais · verso'),
    createSpan('english-word', word.english, 'en'),
    createTapHint(),
  );

  inner.append(front, back);
  card.append(inner);
  slide.append(card);
  return slide;
}

function setSlideSide(slide, side) {
  if (!slide) return;
  const inner = slide.querySelector('.card-inner');
  inner.getAnimations().forEach((animation) => animation.cancel());
  inner.classList.toggle('is-flipped', side === 'verso');
  shownSide = side;
  elements.sideCaption.textContent = side === 'recto' ? 'Grec affiché' : 'Anglais affiché';
}

function updateControls() {
  const randomMode = elements.orderMode.value === 'random';
  elements.counter.hidden = randomMode;
  elements.previous.hidden = randomMode;
  elements.controls.classList.toggle('random-mode', randomMode);
  elements.nextLabel.hidden = !randomMode;
  if (swiper) {
    swiper.params.oneWayMovement = randomMode;
    swiper.params.rewind = !randomMode;
    swiper.allowSlidePrev = !randomMode;
  }
}

function updateActiveSlide(resetSide = true, preservedSide = null) {
  if (!swiper) return;
  const activeSlide = swiper.slides[swiper.activeIndex];
  if (!activeSlide) return;

  displayedWordIndex = Number(activeSlide.dataset.wordIndex);
  if (resetSide) setSlideSide(activeSlide, preservedSide || chooseStartingSide());

  const randomMode = elements.orderMode.value === 'random';
  elements.number.textContent = String(swiper.activeIndex + 1);
  elements.total.textContent = String(words.length);
  elements.previous.hidden = randomMode;
  elements.counter.hidden = randomMode;
}

function replaceSlides(wordIndices, preservedSide = null) {
  if (!swiper) return;
  rebuildingSlides = true;
  swiper.removeAllSlides();
  swiper.appendSlide(wordIndices.map(createSlide));
  swiper.update();
  swiper.slideTo(0, 0, false);
  updateControls();
  updateActiveSlide(true, preservedSide);
  rebuildingSlides = false;
}

function startAllWords(currentWordIndex = null) {
  allOrder = currentWordIndex === null
    ? shuffle(words.map((_, index) => index))
    : [currentWordIndex, ...shuffle(words.map((_, index) => index).filter((index) => index !== currentWordIndex))];
  replaceSlides(allOrder);
}

function startRandomMode(currentWordIndex = displayedWordIndex, preservedSide = null) {
  const nextIndices = Array.from({ length: RANDOM_LOOKAHEAD }, randomWordIndex);
  replaceSlides([currentWordIndex, ...nextIndices], preservedSide);
}

function configureSwiper() {
  swiper = new Swiper(elements.slider, {
    effect: 'creative',
    slidesPerView: 1,
    speed: 650,
    grabCursor: true,
    rewind: true,
    oneWayMovement: false,
    preventInteractionOnTransition: true,
    creativeEffect: {
      prev: { shadow: true, translate: ['-120%', 0, -500] },
      next: { shadow: true, translate: ['120%', 0, -500] },
      limitProgress: 1,
      perspective: true,
    },
    on: {
      slideChangeTransitionStart() {
        if (!rebuildingSlides) updateActiveSlide();
      },
      slideChangeTransitionEnd() {
        if (rebuildingSlides || elements.orderMode.value !== 'random') return;

        if (swiper.activeIndex >= RANDOM_LOOKAHEAD) {
          startRandomMode(displayedWordIndex, shownSide);
        } else {
          swiper.appendSlide(createSlide(randomWordIndex()));
          swiper.update();
        }
      },
    },
  });
}

function navigate(direction) {
  if (!swiper || swiper.animating) return;
  if (elements.orderMode.value === 'random') {
    swiper.slideNext();
  } else if (direction < 0) {
    swiper.slidePrev();
  } else {
    swiper.slideNext();
  }
}

elements.slider.addEventListener('click', (event) => {
  const card = event.target.closest('.flashcard');
  if (!card || !card.closest('.swiper-slide-active')) return;

  const inner = card.querySelector('.card-inner');
  const fromTransform = getComputedStyle(inner).transform;
  inner.getAnimations().forEach((animation) => animation.cancel());
  shownSide = shownSide === 'recto' ? 'verso' : 'recto';
  inner.classList.toggle('is-flipped', shownSide === 'verso');
  const toTransform = shownSide === 'recto' ? 'rotateY(0deg)' : 'rotateY(180deg)';
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    inner.animate(
      [{ transform: fromTransform }, { transform: toTransform }],
      { duration: 650, easing: 'cubic-bezier(.2,.72,.22,1)' },
    );
  }
  elements.sideCaption.textContent = shownSide === 'recto' ? 'Grec affiché' : 'Anglais affiché';
});

elements.previous.addEventListener('click', () => navigate(-1));
elements.next.addEventListener('click', () => navigate(1));
elements.orderMode.addEventListener('change', () => {
  if (!words.length) return;
  const currentWord = displayedWordIndex;
  const currentSide = shownSide;
  if (elements.orderMode.value === 'random') {
    startRandomMode(currentWord, currentSide);
  } else {
    startAllWords(currentWord);
  }
});
elements.mode.addEventListener('change', () => {
  localStorage.setItem(STORAGE_KEY, elements.mode.value);
  updateActiveSlide(true);
});

document.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.target instanceof HTMLSelectElement) return;
  if (event.key === 'ArrowLeft') navigate(-1);
  if (event.key === 'ArrowRight') navigate(1);
  if (event.key === ' ' && !(event.target instanceof HTMLButtonElement)) {
    event.preventDefault();
    elements.slider.querySelector('.swiper-slide-active .flashcard')?.click();
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
    elements.wordCount.textContent = `${words.length} mots`;
    configureSwiper();
    startAllWords();
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
