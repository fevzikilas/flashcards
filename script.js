let flashcards = [];
let currentCardIndex = 0;
let currentCard = null;
const MAX_LOG_SIZE = 10; 
let remainingAttempts = 3;


async function loadDeck(filename) {
    try {
        
        const savedDeck = localStorage.getItem(filename);
        
        if (savedDeck) {
            
            flashcards = JSON.parse(savedDeck);
            
            flashcards = flashcards.map(card => ({
                ...card,
                lastAttempts: card.lastAttempts || [],
                attempts: card.attempts || 0,
                successRate: card.successRate || 0,
                lastSeen: card.lastSeen || null,
                difficulty: card.difficulty || 1
            }));
        } else {
            
            const response = await fetch(`decks/${filename}`);
            if (!response.ok) {
                throw new Error('Dosya yüklenemedi');
            }
            flashcards = await response.json();
            
            
            flashcards = flashcards.map(card => ({
                ...card,
                lastAttempts: [],
                attempts: 0,
                successRate: 0,
                lastSeen: null,
                difficulty: 1
            }));
            
            
            localStorage.setItem(filename, JSON.stringify(flashcards));
        }
        
        showNextCard();
    } catch (error) {
        document.querySelector('.question').textContent = "Dosya yüklenirken bir hata oluştu!";
        console.error('Hata:', error);
    }
}

function similarity(str1, str2) {
    str1 = str1.toLowerCase();
    str2 = str2.toLowerCase();
    
    if (str1 === str2) return 100;
    
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    for (let j = 1; j <= len2; j++) {
        for (let i = 1; i <= len1; i++) {
            const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1,
                matrix[j - 1][i] + 1,
                matrix[j - 1][i - 1] + substitutionCost
            );
        }
    }

    const maxLen = Math.max(len1, len2);
    return Math.round((1 - matrix[len2][len1] / maxLen) * 100);
}

function updateCardStats(card, similarityScore) {
    const isSuccess = similarityScore >= 80;
    
    
    if (!card.lastAttempts) {
        card.lastAttempts = [];
    }
    
    
    if (card.lastAttempts.length >= 10) {
        card.lastAttempts.shift(); 
    }
    card.lastAttempts.push(isSuccess ? 1 : 0); 
    
    
    card.attempts = card.attempts || 0;
    card.attempts++;
    
    
    const successfulAttempts = card.lastAttempts.filter(x => x === 1).length;
    card.successRate = (successfulAttempts / card.lastAttempts.length) * 100;
    
    
    card.lastSeen = new Date().toISOString();
    
    
    updateDifficulty(card);
    
    
    const deckSelect = document.getElementById('deckSelect');
    if (deckSelect.value) {
        localStorage.setItem(deckSelect.value, JSON.stringify(flashcards));
    }
    
    
    showAttemptHistory(card);
}

function updateDifficulty(card) {
    
    const recentAttempts = card.lastAttempts.slice(-3);
    if (recentAttempts.length >= 3) {
        const recentSuccess = recentAttempts.filter(x => x === 1).length;
        
        if (recentSuccess === 3) {
            card.difficulty = Math.max(1, card.difficulty - 1); 
        } else if (recentSuccess === 0) {
            card.difficulty = Math.min(5, card.difficulty + 1); 
        }
    }
}

function getNextCard() {
    const now = new Date();
    
    
    const sortedCards = flashcards.sort((a, b) => {
        
        if (!a.lastSeen) return -1;
        if (!b.lastSeen) return 1;
        
        
        if (a.difficulty !== b.difficulty) {
            return b.difficulty - a.difficulty;
        }
        
        
        if (Math.abs(a.successRate - b.successRate) > 10) {
            return a.successRate - b.successRate;
        }
        
        
        return new Date(a.lastSeen) - new Date(b.lastSeen);
    });
    
    return sortedCards[0];
}

function showNextCard() {
    if (flashcards.length === 0) {
        document.querySelector('.question').textContent = "Henüz kart eklenmemiş!";
        document.querySelector('.input-area').style.display = 'none';
        return;
    }

    if (currentCardIndex >= flashcards.length - 1) {
        currentCardIndex = 0;
    } else {
        currentCardIndex++;
    }

    showCard(currentCardIndex);
}

function checkAnswer() {
    const userAnswer = document.querySelector('#answer-input').value;
    const similarityScore = similarity(userAnswer, currentCard.answer);
    const feedbackElement = document.querySelector('.feedback');
    const understoodBtn = document.querySelector('#understood-btn');
    const attemptsElement = document.querySelector('.attempts');
    const correctAnswerElement = document.querySelector('.correct-answer');
    
    if (similarityScore >= 80) {
        if (similarityScore === 100) {
            feedbackElement.innerHTML = "🎉🎉 Perfect! 🎉🎉";
        } else if (similarityScore >= 90) {
            feedbackElement.innerHTML = "True! Similarity: %" + similarityScore;
        } else {
            feedbackElement.innerHTML = 
                `<div>Very close! Similarity: %${similarityScore}</div>
                 <div class="mt-1">Accept it as True for now.</div>`;
        }
        
        feedbackElement.style.color = '#28a745';
        correctAnswerElement.innerHTML = `
            <i class="fas fa-star text-orange-500"></i>
            <span>Answer: ${currentCard.answer}</span>
        `;
        updateCardStats(currentCard, similarityScore);
        understoodBtn.classList.remove('hidden');
        document.querySelector('#answer-input').disabled = true;
    } else {
        remainingAttempts--;
        attemptsElement.textContent = `Remaining Attempts: ${remainingAttempts}`;
        
        if (remainingAttempts <= 0) {
            feedbackElement.innerHTML = "😔 Wrong!! 😔";
            feedbackElement.style.color = '#dc3545';
            correctAnswerElement.innerHTML = `
                <i class="fas fa-info-circle text-orange-500"></i>
                <span>Answer: ${currentCard.answer}</span>
            `;
            understoodBtn.classList.remove('hidden');
            document.querySelector('#answer-input').disabled = true;
            updateCardStats(currentCard, similarityScore);
        } else {
            feedbackElement.innerHTML = "Ooops. Try again. Similarity: %" + similarityScore;
            feedbackElement.style.color = '#dc3545';
        }
    }
}


document.getElementById('deckSelect').addEventListener('change', function(e) {
    if (e.target.value) {
        loadDeck(e.target.value);
    }
});


function resetProgress() {
    const deckSelect = document.getElementById('deckSelect');
    if (deckSelect.value && confirm('Bu deck için tüm ilerlemenizi sıfırlamak istediğinize emin misiniz?')) {
        localStorage.removeItem(deckSelect.value);
        loadDeck(deckSelect.value);
    }
}


function showProgress() {
    const currentDeck = document.getElementById('deckSelect').value;
    if (currentDeck && flashcards) {
        
        const totalAttempts = flashcards.reduce((sum, card) => sum + (card.attempts || 0), 0);
        const successfulAttempts = flashcards.reduce((sum, card) => {
            return sum + (card.lastAttempts || []).filter(attempt => attempt === 1).length;
        }, 0);
        
        const lastStudyTime = flashcards.reduce((latest, card) => {
            if (!card.lastSeen) return latest;
            const cardTime = new Date(card.lastSeen);
            return cardTime > latest ? cardTime : latest;
        }, new Date(0));

        const timeStr = lastStudyTime.getTime() === 0 ? 
            'Henüz çalışılmadı' : 
            formatTimeAgo(lastStudyTime);

        
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'bg-black rounded-xl p-8 shadow-2xl border-2 border-orange-500 max-w-md w-full mx-4 relative';
        
        
        const deckName = currentDeck.replace('.json', '').charAt(0).toUpperCase() + currentDeck.slice(1, -5);
        
        modalContent.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-orange-500 text-xl font-bold">${deckName} Deck Progress</h2>
                <button class="text-orange-500 hover:text-orange-400 transition-colors">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            <div class="text-white space-y-4">
                <div class="flex items-center gap-3">
                    <i class="fas fa-chart-bar text-orange-500 text-lg w-6"></i>
                    <span>Toplam Deneme: ${totalAttempts}</span>
                </div>
                <div class="flex items-center gap-3">
                    <i class="fas fa-check-circle text-orange-500 text-lg w-6"></i>
                    <span>Başarılı Deneme: ${successfulAttempts}</span>
                </div>
                <div class="flex items-center gap-3">
                    <i class="fas fa-clock text-orange-500 text-lg w-6"></i>
                    <span>Son Çalışma: ${timeStr}</span>
                </div>
            </div>
        `;

        
        const closeModal = () => modalOverlay.remove();
        
        
        modalContent.querySelector('button').addEventListener('click', closeModal);
        
        
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });
        
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });

        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
    }
}


function formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Az önce';
    if (diffMins < 60) return `${diffMins} dakika önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    if (diffDays === 1) return 'Dün';
    return `${diffDays} gün önce`;
}


document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const understoodBtn = document.querySelector('#understood-btn');
        if (!understoodBtn.classList.contains('hidden')) {
            
            nextCard();
        } else {
            
            checkAnswer();
        }
    }
});


document.addEventListener('keydown', function(e) {
    if (e.altKey) { 
        switch(e.key) {
            case 'ArrowLeft':
                e.preventDefault(); 
                previousCard();
                break;
            case 'ArrowRight':
                e.preventDefault(); 
                nextCard();
                break;
        }
    }
});


function previousCard() {
    if (currentCardIndex > 0) {
        currentCardIndex--;
        showCard(currentCardIndex);
    }
}


function nextCard() {
    showNextCard();
}


function showCard(index) {
    currentCard = flashcards[index];
    document.querySelector('.question').textContent = currentCard.question;
    document.querySelector('.input-area').style.display = 'flex';
    document.querySelector('.feedback').textContent = '';
    document.querySelector('.correct-answer').textContent = '';
    document.querySelector('.attempts').textContent = '';
    document.querySelector('#answer-input').value = '';
    document.querySelector('#answer-input').disabled = false;
    document.querySelector('#answer-input').focus();
    document.querySelector('#understood-btn').classList.add('hidden');
    remainingAttempts = 3;
    
    
    showAttemptHistory(currentCard);
}

function showAttemptHistory(card) {
    const historyContainer = document.querySelector('.attempt-history');
    historyContainer.innerHTML = '';
    
    const attempts = card.lastAttempts || [];
    
    if (attempts.length === 0) {
        
        historyContainer.innerHTML = `
            <div class="flex items-center justify-center gap-2 text-orange-500">
                <span class="text-sm font-medium">No Attempts Yet </span>
            </div>
        `;
        return;
    }
    
    
    attempts.forEach((attempt) => {
        const dot = document.createElement('div');
        if (attempt === 1) {
            
            dot.innerHTML = `
                <i class="fas fa-circle text-orange-500 text-xs" 
                   title="Başarılı deneme"></i>
            `;
        } else {
            
            dot.innerHTML = `
                <i class="far fa-circle text-orange-500 text-xs" 
                   title="Başarısız deneme"></i>
            `;
        }
        historyContainer.appendChild(dot);
    });
}