// Адрес бэкенда.
// Локально (npm run dev) — используется localhost.
// В продакшене — через /api/ на том же домене (Nginx проксирует)
const API_URL = import.meta.env.DEV
    ? "http://127.0.0.1:8000"
    : "/api";

function authHeaders() {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

// Извлекает читаемое сообщение из ответа API.
// FastAPI/Pydantic v2 может вернуть detail как строку или массив объектов.
function extractError(errData, fallback) {
    if (!errData) return fallback;
    if (typeof errData.detail === 'string') return errData.detail;
    if (Array.isArray(errData.detail) && errData.detail.length > 0) {
        const msg = errData.detail[0].msg || '';
        if (msg.toLowerCase().includes('email')) return 'Некорректный формат почты';
        return msg.replace(/^Value error,\s*/i, '') || fallback;
    }
    return fallback;
}


// Получить все тесты пользователя
export async function fetchTests() {
    const res = await fetch(`${API_URL}/tests`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Не удалось загрузить тесты");
    return res.json();
}

// Получить тест по share-коду (для прохождения по ссылке)
export async function fetchTestByCode(code) {
    const res = await fetch(`${API_URL}/tests/by-code/${code}`);
    if (!res.ok) throw new Error("Тест не найден");
    return res.json();
}

// Создать новый тест
export async function createTest(test) {
    const res = await fetch(`${API_URL}/tests`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
            title: test.title,
            type: test.type,
            questions: test.questions,
            time_limit: test.timeLimit || 0,
            shuffle_questions: test.shuffleQuestions || false,
            folder: test.folder || "",
            random_count: test.randomCount || 0,
        }),
    });
    if (!res.ok) throw new Error("Не удалось создать тест");
    return res.json();
}

// Удалить тест
export async function deleteTest(testId) {
    const res = await fetch(`${API_URL}/tests/${testId}`, { method: "DELETE", headers: authHeaders() });
    if (!res.ok) throw new Error("Не удалось удалить тест");
    return res.json();
}

// Обновить существующий тест
export async function updateTest(testId, test) {
    const res = await fetch(`${API_URL}/tests/${testId}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
            title: test.title,
            type: test.type,
            questions: test.questions,
            time_limit: test.timeLimit || 0,
            shuffle_questions: test.shuffleQuestions || false,
            folder: test.folder || "",
            random_count: test.randomCount || 0,
        }),
    });
    if (!res.ok) throw new Error("Не удалось обновить тест");
    return res.json();
}


// Отправить прохождение теста
export async function submitTest(testId, submission) {
    const res = await fetch(`${API_URL}/tests/${testId}/submissions`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(submission),
    });
    if (!res.ok) throw new Error("Не удалось отправить ответы");
    return res.json();
}


// Удалить одно прохождение (результат) — сам тест остаётся
export async function deleteSubmission(testId, subId) {
    const res = await fetch(`${API_URL}/tests/${testId}/submissions/${subId}`, {
        method: "DELETE",
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Не удалось удалить результат");
    return res.json();
}


// ==================== АВТОРИЗАЦИЯ ====================

// Шаг 1 регистрации — отправить код на почту
export async function registerStart(email, login, password) {
    const res = await fetch(`${API_URL}/auth/register/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, login, password }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(extractError(err, 'Ошибка регистрации'));
    }
    return res.json();
}

// Шаг 2 регистрации — подтвердить код
export async function registerConfirm(email, code) {
    const res = await fetch(`${API_URL}/auth/register/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(extractError(err, 'Неверный код'));
    }
    return res.json();
}

// Вход по логину/email + пароль
export async function loginUser(login, password) {
    const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(extractError(err, 'Ошибка входа'));
    }
    return res.json();
}

// Восстановление пароля — шаг 1 (отправить код)
export async function resetStart(email) {
    const res = await fetch(`${API_URL}/auth/reset/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error('Ошибка');
    return res.json();
}

// Восстановление пароля — шаг 2 (новый пароль)
export async function resetConfirm(email, code, newPassword) {
    const res = await fetch(`${API_URL}/auth/reset/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, new_password: newPassword }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Неверный код');
    }
    return res.json();
}

// Напомнить логин по почте
export async function forgotLogin(email) {
    const res = await fetch(`${API_URL}/auth/forgot-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error('Ошибка');
    return res.json();
}
