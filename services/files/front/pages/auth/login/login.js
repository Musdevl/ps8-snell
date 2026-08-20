import * as accountService from "../../../services/account-service.js"

const game = document.getElementById('game');
const resetForm = document.getElementById('reset-form');
const forgotChoice = document.getElementById('forgot-choice');
const quizForm = document.getElementById('quiz-form');
const quizResult = document.getElementById('quiz-result');
const resultLabel = document.getElementById('result-label');
const resultForm = document.getElementById('result-form');
const rightContainer = document.querySelector('.right-container');

const quizSteps = ['step-honesty', 'step-drag'];
let currentStep = 0;
let score = 0;

// ── Mobile helpers ────────────────────────────────────────────────────────────

function isMobile() {
    return window.innerWidth <= 64 * 16;
}

function slideIn() {
    if (isMobile()) {
        rightContainer.classList.remove("slide-out");
        rightContainer.classList.add('slide-in');
    }
}

function slideOut() {
    if (isMobile()) rightContainer.classList.remove('slide-in');
    rightContainer.classList.add('slide-out');
}

// ── Bouton retour (mobile) ────────────────────────────────────────────────────

document.querySelector('.back-btn')?.addEventListener('click', () => {
    switch (currentStep) {
        case 1:
            forgotChoice.classList.remove('hidden');
            resetForm.classList.add('hidden');
            currentStep = 0;
            break;
        case 2:
            forgotChoice.classList.remove('hidden');
            quizForm.classList.add('hidden');
            currentStep = 0;

            quizSteps.forEach(id => {
                document.getElementById(id).resetChoice();
            });

            break;
        case 3:
            quizSteps.forEach(id => {
                document.getElementById(id).resetChoice();
            });
            quizForm.classList.remove('hidden');
            document.getElementById(quizSteps[currentStep - 2]).classList.add('hidden');
            score = 0;
            currentStep -= 1;
            document.getElementById(quizSteps[currentStep - 2]).classList.remove('hidden');


            break;
        default:
            slideOut();
            hideRight();
            game.classList.remove('hidden');
            forgotChoice.classList.add('hidden');
            break;
    }

});

// ── Logique existante ─────────────────────────────────────────────────────────

function hideRight() {
    game.classList.add('hidden');
    resetForm.classList.add('hidden');
    quizForm.classList.add('hidden');
    quizResult.classList.add('hidden');
    forgotChoice.classList.add('hidden');
}

function showResult(passed) {
    quizForm.classList.add('hidden');
    quizResult.classList.remove('hidden');
    resultLabel.textContent = `RESULT : ${passed ? 'Honest' : 'Liar'}`;
    resultLabel.className = `result-label ${passed ? 'honest' : 'liar'}`;
    resultForm.classList.add('hidden');
    if (passed) resultForm.classList.remove('hidden');
}

document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    await accountService.login(email, password);
});

document.getElementById('forgot-btn').addEventListener('click', (e) => {
    e.preventDefault();
    hideRight();
    forgotChoice.classList.remove('hidden');
    slideIn();

    quizSteps.forEach(id => {
        document.getElementById(id).resetChoice();
    });
});

document.getElementById('choice-mail-btn').addEventListener('click', () => {
    currentStep += 1;
    forgotChoice.classList.add('hidden');
    hideRight();
    resetForm.classList.remove('hidden');
});

document.getElementById('choice-quiz-btn').addEventListener('click', () => {
    forgotChoice.classList.add('hidden');
    hideRight();
    quizForm.classList.remove('hidden');
    currentStep += 2;
    score = 0;

    quizSteps.forEach((id, i) => {
        const el = document.getElementById(id);
        if (i === 0) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });
});

document.getElementById('reset-btn').addEventListener('click', async () => {
    const email = document.getElementById('reset-email').value;
    await accountService.requestPasswordReset(email);
});

document.getElementById('quiz-next-btn').addEventListener('click', () => {
    const el = document.getElementById(quizSteps[currentStep - 2]);
    if (el.check()) score++;

    currentStep++;

    if ((currentStep - 2) < quizSteps.length) {
        el.classList.add('hidden');
        document.getElementById(quizSteps[currentStep - 2]).classList.remove('hidden');
        return;
    }

    currentStep = 0;
    showResult(score === quizSteps.length);
});

document.getElementById('result-btn').addEventListener('click', async () => {
    const email = document.getElementById('result-email').value;
    const new_password = document.getElementById('result-password').value;
    await accountService.hardResetPassword(email, new_password);
});