let deck = [];
let discardPile = [];
let playerHands = { 1: [], 2: [], 3: [] };


function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}


function buildDeck() {
  const newDeck = [];


  newDeck.push("\\mathbf{JOLLY}", "\\mathbf{JOLLY}");

  // 2. 16 Sigma: 4 carte per ogni σ_i (i=0..3)
  for (let i = 0; i <= 3; i++) {
    for (let k = 0; k < 4; k++) {
      newDeck.push(`\\sigma_{${i}}`);
    }
  }

  // 3. 12 Sigma Inverse: 4 carte per ogni σ_i^{-1} (i=1..3)
  for (let i = 1; i <= 3; i++) {
    for (let k = 0; k < 4; k++) {
      newDeck.push(`\\sigma_{${i}}^{-1}`);
    }
  }

  // 4. 30 Tau: δ_i δ_j con i,j ∈ {1,2,3} distinti (24 uniche + 6 extra)
  const tauWords = [];
  const indices = [1, 2, 3];

  for (let i of indices) {
    for (let j of indices) {
      if (i === j) continue;
      const pos1 = [`\\sigma_{${i}}`, `\\sigma_{${i}}^{-1}`];
      const pos2 = [`\\sigma_{${j}}`, `\\sigma_{${j}}^{-1}`];
      for (let p1 of pos1) {
        for (let p2 of pos2) {
          tauWords.push(`${p1} ${p2}`);
        }
      }
    }
  }
  newDeck.push(...tauWords);
  const tauExtras = [
    "\\sigma_1 \\sigma_2", "\\sigma_1 \\sigma_3", 
    "\\sigma_2 \\sigma_1", "\\sigma_2 \\sigma_3", 
    "\\sigma_3 \\sigma_1", "\\sigma_3 \\sigma_2"
  ];
  newDeck.push(...tauExtras);

  // 5. 150 Rho: δ_i δ_j δ_k con i,j,k ∈ {1,2,3}, SENZA cancellazioni adiacenti
  const alphabet = [
    { code: "\\sigma_1", inv: "\\sigma_1^{-1}" },
    { code: "\\sigma_1^{-1}", inv: "\\sigma_1" },
    { code: "\\sigma_2", inv: "\\sigma_2^{-1}" },
    { code: "\\sigma_2^{-1}", inv: "\\sigma_2" },
    { code: "\\sigma_3", inv: "\\sigma_3^{-1}" },
    { code: "\\sigma_3^{-1}", inv: "\\sigma_3" }
  ];

  for (let l1 of alphabet) {
    for (let l2 of alphabet) {
      if (l2.code === l1.inv) continue; 

      for (let l3 of alphabet) {
        if (l3.code === l2.inv) continue; 

        newDeck.push(`${l1.code} ${l2.code} ${l3.code}`);
      }
    }
  }

  return shuffle(newDeck);
}


function initDeckSystem() {
  deck = buildDeck();
  discardPile = [];
  playerHands = { 1: [], 2: [], 3: [] };
  updateDeckUI();
}


function drawCard() {
  if (deck.length === 0) {
    alert("Il mazzo di sinistra è vuoto! Clicca sul mazzo di destra (scarti) per rimescolare le carte.");
    return;
  }

  const drawnCard = deck.pop();
  playerHands[activePlayer].push(drawnCard);
  renderHand(activePlayer);
  updateDeckUI();
}


function playCard(playerNum, cardIndex) {
  if (playerNum !== activePlayer) {
    setActivePlayer(playerNum);
  }

  const playedCard = playerHands[playerNum].splice(cardIndex, 1)[0];
  discardPile.push(playedCard);

  renderHand(playerNum);
  updateDeckUI();
}


function reshuffleDiscard() {
  if (deck.length > 0) {
    return; 
  }

  if (discardPile.length === 0) {
    alert("Non ci sono carte negli scarti da rimescolare!");
    return;
  }

  deck = shuffle([...discardPile]);
  discardPile = [];
  updateDeckUI();
}


function updateDeckUI() {
  const drawDeckEl = document.getElementById('draw-deck-slot');
  const playedSlot = document.getElementById('played-card-slot');
  const deckCountEl = document.getElementById('deck-count');
  const discardCountEl = document.getElementById('discard-count');

  if (deckCountEl) deckCountEl.innerText = deck.length;
  if (discardCountEl) discardCountEl.innerText = discardPile.length;


  if (drawDeckEl) {
    if (deck.length === 0) {
      drawDeckEl.classList.add('empty');
      drawDeckEl.innerHTML = `<span>VUOTO</span><small id="deck-count">0</small>`;
    } else {
      drawDeckEl.classList.remove('empty');
      drawDeckEl.innerHTML = `<span>MAZZO</span><small id="deck-count">${deck.length}</small>`;
    }
  }


  if (playedSlot) {
    if (discardPile.length === 0) {
      playedSlot.className = 'card-placeholder';
      playedSlot.innerHTML = 'Vuoto';
    } else {
      const topCard = discardPile[discardPile.length - 1];
      const isJolly = topCard.includes("JOLLY");
      playedSlot.className = `card ${isJolly ? 'jolly-card' : ''}`;
      playedSlot.innerHTML = `$${topCard}$`;
    }

    if (deck.length === 0 && discardPile.length > 0) {
      playedSlot.classList.add('clickable-reshuffle');
    } else {
      playedSlot.classList.remove('clickable-reshuffle');
    }
  }

  triggerMathJax();
}


function renderHand(playerNum) {
  const handContainer = document.getElementById(`hand-${playerNum}`);
  if (!handContainer) return;

  handContainer.innerHTML = '';
  playerHands[playerNum].forEach((cardVal, index) => {
    const isJolly = cardVal.includes("JOLLY");
    const cardEl = document.createElement('div');
    cardEl.className = `card ${isJolly ? 'jolly-card' : ''}`;
    cardEl.innerHTML = `$${cardVal}$`;
    cardEl.onclick = () => playCard(playerNum, index);
    handContainer.appendChild(cardEl);
  });

  triggerMathJax();
}


function triggerMathJax() {
  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise();
  }
}
