import React, { useState, useEffect, useCallback } from 'react';
import {
  User, Plus, FileText, BarChart3, ClipboardList, Trash2,
  ChevronLeft, Check, X, CircleDot, /*Image as ImageIcon,*/
  CheckSquare, Type, Award, Eye, Send, ListChecks,
  LogOut, Share2, Copy, Mail, Lock, KeyRound, ArrowLeft,
  EyeOff, ArrowLeftRight, Clock, Download, Shuffle, AlertCircle,
  GripVertical, ChevronUp, ChevronDown, FolderOpen, /*FolderPlus,
  QrCode,*/ Moon, Sun, Upload
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  fetchTests, createTest, deleteTest, submitTest,
  updateTest, deleteSubmission, fetchTestByCode, registerStart,
  registerConfirm, loginUser, resetStart, resetConfirm, forgotLogin
} from './api';

import { csvToQuestions } from './csvImport';

// Типы тестов — объявлены в начале, доступны всем компонентам
const TYPE_LABELS = {
  quiz: { label: 'Тест с баллами', color: 'bg-indigo-100 text-indigo-700', icon: Award },
  survey: { label: 'Опрос / сбор данных', color: 'bg-emerald-100 text-emerald-700', icon: ClipboardList },
  analytics: { label: 'Аналитика', color: 'bg-amber-100 text-amber-700', icon: BarChart3 },
};


export default function TestApp() {
  // При запуске пытаемся достать сохранённое имя из localStorage
  const savedUser = localStorage.getItem('username') || '';
  const [screen, setScreen] = useState(savedUser ? 'menu' : 'login');
  const [username, setUsername] = useState(savedUser);
  const [tests, setTests] = useState([]);
  const [activeTest, setActiveTest] = useState(null); // тест, который проходим/смотрим
  const [editingTest, setEditingTest] = useState(null); // тест, который редактируем
  const [loading, setLoading] = useState(false);
  const [resultsSource, setResultsSource] = useState('resultslist');
  const [activeFolder, setActiveFolder] = useState('');

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);


  // Выход из аккаунта: чистим имя и возвращаем на экран входа
  const handleLogout = () => {
    localStorage.removeItem('username');
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    setUsername('');
    setScreen('login');
  };

  // Загрузить тесты пользователя с сервера
  const loadTests = async () => {
    try {
      setLoading(true);
      const data = await fetchTests();
      setTests(data);
    } catch (e) {
      console.error(e);
      alert('Не удалось загрузить тесты. Запущен ли сервер?');
    } finally {
      setLoading(false);
    }
  };

  // Сохраняем данные пользователя после успешного входа/регистрации
  const applyAuth = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.login);
    localStorage.setItem('email', data.email);
    setUsername(data.login);
    loadTests();
    setScreen('menu');
  };


  // Тест, ссылкой на который сейчас делимся (для модального окна)
  const [shareTest, setShareTest] = useState(null);
  // Гостевой режим: когда зашли по ссылке ?code=...
  const [guestTest, setGuestTest] = useState(null);
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState('');
  const [attemptKey, setAttemptKey] = useState(0);   // для пересоздания TestTaking
  const [lastSubmission, setLastSubmission] = useState(null);

  // При запуске приложения проверяем — есть ли в адресе ?code=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGuestLoading(true);
      setScreen('guest');
      fetchTestByCode(code)
        .then((test) => {
          setGuestTest(test);
          setGuestLoading(false);
        })
        .catch(() => {
          setGuestError('Тест не найден или ссылка устарела');
          setGuestLoading(false);
        });
    } else if (localStorage.getItem('username')) {
      loadTests();
    }
  }, []);

  // ----- ГОСТЕВОЙ ЭКРАН (заход по ссылке ?code=) -----
  if (screen === 'guest') {
    if (guestLoading) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="text-gray-500 dark:text-gray-400 text-center">
            <ClipboardList className="w-10 h-10 mx-auto mb-2 animate-pulse text-indigo-400" />
            Загрузка теста...
          </div>
        </div>
      );
    }
    if (guestError) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg w-full max-w-sm p-6 text-center">
            <X className="w-10 h-10 mx-auto mb-2 text-red-400" />
            <p className="text-gray-700 dark:text-gray-200 font-medium mb-4">{guestError}</p>
            <button
              onClick={() => {
                window.history.replaceState({}, '', '/');
                setScreen(localStorage.getItem('username') ? 'menu' : 'login');
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg"
            >
              На главную
            </button>
          </div>
        </div>
      );
    }
if (guestTest) {
  return (
    <TestTaking
      key={`guest-${guestTest.id}-${attemptKey}`}
      test={guestTest}
      onCancel={() => {
        setGuestTest(null);
        setGuestError('');
        window.history.replaceState({}, '', '/');
        setScreen(localStorage.getItem('username') ? 'menu' : 'login');
      }}
      onSubmit={async (submission) => {
        try {
          await submitTest(guestTest.id, submission);
          // Сохраняем для показа разбора
          setLastSubmission(submission);
          setScreen('guest-result');   // новый экран
        } catch (e) {
          console.error('Не удалось отправить ответы:', e);
          alert('Не удалось отправить ответы. Попробуйте ещё раз.');
        }
      }}
    />
  );
}
    return null;
  }

  // ----- РЕЗУЛЬТАТ ПРОХОЖДЕНИЯ (для гостя, сразу после отправки) -----
  if (screen === 'guest-result' && lastSubmission && guestTest) {
  return (
    <TestResultScreen
      test={guestTest}
      submission={lastSubmission}
      onRetry={() => {
        setLastSubmission(null);
        setAttemptKey((k) => k + 1);
        setScreen('guest');
      }}
      onHome={() => {
        setGuestTest(null);
        setLastSubmission(null);
        window.history.replaceState({}, '', '/');
        setScreen(localStorage.getItem('username') ? 'menu' : 'login');
      }}
    />
  );
}

  // ----- ЭКРАН АВТОРИЗАЦИИ (вход / регистрация / сброс пароля) -----
  if (screen === 'login') {
    return <AuthScreen onAuth={applyAuth} />;
  }

  // ----- ГЛАВНОЕ МЕНЮ -----
  if (screen === 'menu') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header username={username} onLogout={handleLogout} darkMode={darkMode} onToggleDark={() => setDarkMode(!darkMode)} />
        <div className="max-w-md mx-auto p-4 space-y-3">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Главное меню</h2>
          <MenuCard
            icon={<Plus className="w-6 h-6 text-white" />}
            color="bg-indigo-600"
            title="Создать тест"
            subtitle="Новый тест, опрос или анкета"
            onClick={() => setScreen('create')}
          />
          <MenuCard
            icon={<FileText className="w-6 h-6 text-white" />}
            color="bg-emerald-600"
            title="Мои тесты"
            subtitle={`${tests.length} ${plural(tests.length)}`}
            onClick={() => setScreen('mytests')}
          />
          <MenuCard
            icon={<BarChart3 className="w-6 h-6 text-white" />}
            color="bg-amber-600"
            title="Результаты"
            subtitle="Ответы и статистика"
            onClick={() => setScreen('resultslist')}
          />
        </div>
      </div>
    );
  }

  // ----- СОЗДАНИЕ / РЕДАКТИРОВАНИЕ ТЕСТА -----
  if (screen === 'create') {
    return (
      <TestCreator
        username={username}
        editingTest={editingTest}
        onCancel={() => {
          const wasEditing = !!editingTest;
          setEditingTest(null);
          setScreen(wasEditing ? 'mytests' : 'menu');
        }}
        onSave={async (test) => {
          try {
            if (editingTest) {
              // режим редактирования — обновляем
              const updated = await updateTest(editingTest.id, test);
              setTests((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
              setEditingTest(null);
            } else {
              // режим создания — создаём новый
              const saved = await createTest(test);
              setTests((prev) => [...prev, saved]);
            }
            setScreen('mytests');
          } catch (e) {
            console.error(e);
            alert('Не удалось сохранить тест. Запущен ли сервер?');
          }
        }}
      />
    );
  }

  // ----- МОИ ТЕСТЫ -----
if (screen === 'mytests') {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header
        username={username}
        onLogout={handleLogout}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode(!darkMode)}
      />
      <div className="max-w-md mx-auto p-4">
        <button
          onClick={() => setScreen('menu')}
          className="flex items-center text-indigo-600 mb-3 text-sm font-medium"
        >
          <ChevronLeft className="w-4 h-4" /> Назад
        </button>

        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3">
          Мои тесты
        </h2>

        {loading ? (
          <div className="text-center text-gray-400 py-8">
            <ClipboardList className="w-10 h-10 mx-auto mb-2 animate-pulse text-indigo-400" />
            Загрузка...
          </div>
        ) : (
          <>
            {(() => {
              const folders = [...new Set(tests.map(t => t.folder || '').filter(Boolean))];
              if (folders.length === 0) return null;
              return (
                <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                  <button
                    onClick={() => setActiveFolder('')}
                    className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${!activeFolder ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                  >
                    Все
                  </button>
                  {folders.map(f => (
                    <button
                      key={f}
                      onClick={() => setActiveFolder(f)}
                      className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap flex items-center gap-1 ${activeFolder === f ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                    >
                      <FolderOpen className="w-3 h-3" /> {f}
                    </button>
                  ))}
                </div>
              );
            })()}

            {tests.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center text-gray-400">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                Пока нет тестов.<br />Создайте первый!
              </div>
            ) : (
              <div className="space-y-3">
                {tests
                  .filter(t => !activeFolder || (t.folder || '') === activeFolder)
                  .map(t => (
                    <TestListItem
                      key={t.id}
                      test={t}
                      onTake={() => { setActiveTest(t); setAttemptKey(0); setScreen('take'); }}
                      onResults={() => { setResultsSource('mytests'); setActiveTest(t); setScreen('results'); }}
                      onEdit={() => { setEditingTest(t); setScreen('create'); }}
                      onDelete={async () => {
                        try {
                          await deleteTest(t.id);
                          setTests(prev => prev.filter(x => x.id !== t.id));
                        } catch (e) {
                          console.error(e);
                          alert('Не удалось удалить тест.');
                        }
                      }}
                      onShare={() => setShareTest(t)}
                      onDuplicate={async () => {
                        try {
                          const copy = await createTest({
                            title: t.title + ' (копия)',
                            type: t.type,
                            questions: t.questions,
                            timeLimit: t.timeLimit || 0,
                            shuffleQuestions: t.shuffleQuestions || false,
                            folder: t.folder || '',
                            randomCount: t.randomCount || 0,
                          });
                          setTests(prev => [...prev, copy]);
                        } catch (e) {
                          console.error(e);
                          alert('Не удалось дублировать тест.');
                        }
                      }}
                    />
                  ))}
              </div>
            )}
          </>
        )}

        {shareTest && (
          <ShareModal test={shareTest} onClose={() => setShareTest(null)} />
        )}
      </div>
    </div>
  );
}

  // ----- СПИСОК РЕЗУЛЬТАТОВ (отдельный раздел) -----
  if (screen === 'resultslist') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header username={username} darkMode={darkMode} onToggleDark={() => setDarkMode(!darkMode)} />
        <div className="max-w-md mx-auto p-4">
          <button
            onClick={() => setScreen('menu')}
            className="flex items-center text-indigo-600 mb-3 text-sm font-medium"
          >
            <ChevronLeft className="w-4 h-4" /> Назад
          </button>
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3">Результаты тестов</h2>
          {tests.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center text-gray-400">
              <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-50" />
              Пока нет тестов.<br />Сначала создайте тест.
            </div>
          ) : (
            <div className="space-y-3">
              {tests.map((t) => {
                const meta = TYPE_LABELS[t.type];
                const Icon = meta.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => { setResultsSource('resultslist'); setActiveTest(t); setScreen('results'); }}
                    className="w-full bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm hover:shadow-md transition text-left flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${meta.color} mb-1.5`}>
                        <Icon className="w-3 h-3" /> {meta.label}
                      </div>
                      <h3 className="font-semibold text-gray-800 dark:text-gray-100">{t.title}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t.submissions.length} {t.type === 'quiz' ? 'прохожд.' : 'опрошено'}
                      </p>
                    </div>
                    <BarChart3 className="w-5 h-5 text-amber-600 ml-2" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }



  // ----- ПРОХОЖДЕНИЕ ТЕСТА -----
    if (screen === 'take' && activeTest) {
      return (
        <TestTaking
          key={`owner-${activeTest.id}-${attemptKey}`}
          test={activeTest}
          onCancel={() => setScreen('mytests')}
          onSubmit={async (submission) => {
            try {
              const updated = await submitTest(activeTest.id, submission);
              setTests((prev) =>
                prev.map((t) => (t.id === updated.id ? updated : t))
              );
              setActiveTest(updated);
              // Показываем результат тому, кто прошёл
              setLastSubmission(submission);
              setScreen('owner-result');
            } catch (e) {
            console.error(e);
            alert('Не удалось отправить ответы. Запущен ли сервер?');
          }
        }}
      />
    );
  }


    if (screen === 'owner-result' && lastSubmission && activeTest) {
    return (
      <TestResultScreen
        test={activeTest}
        submission={lastSubmission}
        onRetry={() => {
          const fresh = tests.find((t) => t.id === activeTest.id) || activeTest;
          setActiveTest(fresh);
          setLastSubmission(null);
          setAttemptKey((k) => k + 1);
          setScreen('take');
        }}
        onHome={() => {
          setLastSubmission(null);
          setActiveTest(null);
          setScreen('mytests');
        }}
      />
    );
  }

  // ----- РЕЗУЛЬТАТЫ -----
  if (screen === 'results' && activeTest) {
    const fresh = tests.find((t) => t.id === activeTest.id) || activeTest;
    return (
      <TestResults
        test={fresh}
        onBack={() => setScreen(resultsSource)}
        onDeleteSubmission={async (subId) => {
          try {
            const updated = await deleteSubmission(fresh.id, subId);
            setTests((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            setActiveTest(updated);
          } catch (e) {
            console.error(e);
            alert('Не удалось удалить результат.');
          }
        }}
      />
    );
  }

  return null;
}

function TestResultScreen({ test, submission, onRetry, onHome }) {
  const [showReview, setShowReview] = useState(false);

  const isQuiz = test.type === 'quiz';

  const score = submission.score ?? 0;
  const total = submission.total ?? 0;
  const answered = submission.answered ?? 0;
  const skipped = submission.skipped ?? 0;
  const pct = total ? Math.round((score / total) * 100) : 0;

  const isGreat = isQuiz && pct >= 80;
  const isOk = isQuiz && pct >= 50 && pct < 80;
  const isBad = isQuiz && total > 0 && pct < 50;

  const detailed = Array.isArray(submission.detailed) ? submission.detailed : [];

  const servedQuestions = test.questions.filter((q) =>
    detailed.some((d) => d.qid === q.id)
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-40">
      {/* Шапка */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-bold text-gray-800 dark:text-gray-100">Результат</span>
          <span className="w-12" />
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Сводка */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm text-center">
          {isQuiz ? (
            <>
              <div className={`text-5xl font-bold mb-2 ${
                isGreat ? 'text-emerald-600' : isOk ? 'text-amber-600' : 'text-red-500'
              }`}>
                {score}<span className="text-3xl text-gray-400">/{total}</span>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {pct}% правильных
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <div className="text-lg font-bold text-gray-800 dark:text-gray-100">{answered}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">отвечено</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <div className="text-lg font-bold text-gray-800 dark:text-gray-100">{skipped}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">пропущено</div>
                </div>
              </div>
              <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                {isGreat && '🎉 Отличный результат!'}
                {isOk && '👍 Хороший результат.'}
                {isBad && '💪 Попробуйте ещё раз — всё получится.'}
              </div>
            </>
          ) : (
            <>
              <div className="bg-emerald-100 rounded-full p-4 w-fit mx-auto mb-3">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <div className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">
                Спасибо!
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Ваши ответы отправлены.
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <div className="text-lg font-bold text-gray-800 dark:text-gray-100">{answered}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">отвечено</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <div className="text-lg font-bold text-gray-800 dark:text-gray-100">{skipped}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">пропущено</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Кнопка разбора — только для quiz */}
        {isQuiz && servedQuestions.length > 0 && (
          <button
            onClick={() => setShowReview((v) => !v)}
            className="w-full bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-xl py-3 font-medium shadow-sm flex items-center justify-center gap-2"
          >
            <ListChecks className="w-4 h-4" />
            {showReview ? 'Скрыть разбор' : 'Показать разбор ответов'}
          </button>
        )}

        {/* Разбор — только для quiz */}
        {isQuiz && showReview && (
          <div className="space-y-3">
            {servedQuestions.map((q, idx) => (
              <AnswerReview
                key={q.id}
                q={q}
                idx={idx}
                detail={detailed.find((d) => d.qid === q.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Кнопки внизу */}
      <div className="fixed bottom-0 inset-x-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-3">
        <div className="max-w-md mx-auto space-y-2">
          <button
            onClick={onRetry}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2"
          >
            <Shuffle className="w-4 h-4" /> Пройти ещё раз
          </button>
          <button
            onClick={onHome}
            className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium py-2.5 rounded-lg"
          >
            {localStorage.getItem('username') ? 'В личный кабинет' : 'Создать свой тест'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ ============ */

function Header({ username, onLogout, darkMode, onToggleDark }) {
  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
      <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-100 rounded-lg p-1.5">
            <ClipboardList className="w-5 h-5 text-indigo-600" />
          </div>
          <span className="font-bold text-gray-800 dark:text-gray-100">Тесты</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
            <User className="w-4 h-4" />
            {username}
          </div>
          {onToggleDark && (
            <button
              onClick={onToggleDark}
              className="text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition p-1"
              title={darkMode ? 'Светлая тема' : 'Тёмная тема'}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 transition"
              title="Выйти"
            >
              <LogOut className="w-4 h-4" />
              Выйти
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuCard({ icon, color, title, subtitle, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition text-left"
    >
      <div className={`${color} rounded-xl p-3`}>{icon}</div>
      <div>
        <div className="font-semibold text-gray-800 dark:text-gray-100">{title}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</div>
      </div>
    </button>
  );
}

function TestListItem({ test, onTake, onResults, onEdit, onDelete, onShare, onDuplicate }) {
  const meta = TYPE_LABELS[test.type];
  const Icon = meta.icon;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${meta.color} mb-1.5`}>
            <Icon className="w-3 h-3" /> {meta.label}
          </div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">{test.title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {test.randomCount && test.randomCount < test.questions.length
                ? `${test.randomCount} из ${test.questions.length} вопр.`
                : `${test.questions.length} вопр.`}
              {' · '}{test.submissions.length} прохожд.
              {test.timeLimit > 0 && ` · ${test.timeLimit} мин.`}
            </p>
        </div>
        <button onClick={onDelete} className="text-gray-300 hover:text-red-500 p-1">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={onTake}
          className="flex-1 flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 rounded-lg"
        >
          <Eye className="w-4 h-4" /> Пройти
        </button>
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1 bg-amber-100 hover:bg-amber-200 text-amber-700 text-sm font-medium py-2 rounded-lg"
        >
          <Type className="w-4 h-4" /> Изменить
        </button>
        <button
          onClick={onResults}
          className="flex-1 flex items-center justify-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 rounded-lg"
        >
          <BarChart3 className="w-4 h-4" /> Итоги
        </button>
      </div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={onShare}
          className="flex-1 flex items-center justify-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-medium py-2 rounded-lg"
        >
          <Share2 className="w-4 h-4" /> Поделиться
        </button>
        <button
          onClick={onDuplicate}
          className="flex-1 flex items-center justify-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-medium py-2 rounded-lg"
        >
          <Copy className="w-4 h-4" /> Дублировать
        </button>
      </div>
    </div>
  );
}

/* ============ КОНСТРУКТОР ТЕСТА ============ */

function TestCreator({ editingTest, onCancel, onSave }) {
  const [title, setTitle] = useState(editingTest ? editingTest.title : '');
  const [type, setType] = useState(editingTest ? editingTest.type : 'quiz');
  const [questions, setQuestions] = useState(editingTest ? editingTest.questions : []);
  const [timeLimit, setTimeLimit] = useState(editingTest ? (editingTest.timeLimit || 0) : 0);
  const [shuffleQuestions, setShuffleQuestions] = useState(editingTest ? (editingTest.shuffleQuestions || false) : false);
  const [randomCount, setRandomCount] = useState(editingTest ? (editingTest.randomCount || 0) : 0);
  const [folder, setFolder] = useState(editingTest ? (editingTest.folder || '') : '');
  const [error, setError] = useState('');
  const [importErrors, setImportErrors] = useState([]);
  const [importSuccess, setImportSuccess] = useState('');
  
  
  const handleCsvFile = (file) => {
  setImportErrors([]);
  setImportSuccess('');

  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    setImportErrors(['Файл больше 5 МБ']);
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const { questions: imported, errors } = csvToQuestions(text);

    if (imported.length === 0) {
      setImportErrors(errors.length ? errors : ['Не удалось найти вопросы в файле']);
      return;
    }

    setQuestions((prev) => [...prev, ...imported]);
    setImportSuccess(`Загружено ${imported.length} вопр.`);
    if (errors.length) setImportErrors(errors);
    // сбрасываем input, чтобы можно было загрузить тот же файл повторно
    setTimeout(() => setImportSuccess(''), 4000);
  };
  reader.onerror = () => setImportErrors(['Не удалось прочитать файл']);
  reader.readAsText(file, 'UTF-8');
};

  const addQuestion = (format) => {
    if (format === 'order') {
      setQuestions((prev) => [
        ...prev,
        {
          id: Date.now(),
          text: '',
          image: '',
          format: 'order',
          options: [],
          pairs: [],
          correctText: '',
          required: false,
          orderItems: [
            { id: 1, text: '' },
            { id: 2, text: '' },
            { id: 3, text: '' },
          ],
        },
      ]);
      return;
    }
    setQuestions((prev) => [
      ...prev,
      {
        id: Date.now(),
        text: '',
        image: '',
        format, // single | multiple | text | match
        options: (format === 'text' || format === 'match') ? [] : [
          { id: 1, text: '', correct: false },
          { id: 2, text: '', correct: false },
        ],
        pairs: format === 'match' ? [
          { id: 1, leftText: '', leftImage: '', rightText: '', rightImage: '' },
          { id: 2, leftText: '', leftImage: '', rightText: '', rightImage: '' },
        ] : [],
        correctText: '',
      },
    ]);
  };

  const updateQuestion = (qid, patch) =>
    setQuestions((prev) => prev.map((q) => (q.id === qid ? { ...q, ...patch } : q)));

  const removeQuestion = (qid) =>
    setQuestions((prev) => prev.filter((q) => q.id !== qid));

  const addOption = (qid) =>
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qid
          ? { ...q, options: [...q.options, { id: Date.now(), text: '', correct: false }] }
          : q
      )
    );

  const updateOption = (qid, oid, patch) =>
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qid
          ? {
            ...q,
            options: q.options.map((o) => {
              if (o.id !== oid) {
                // для single — снимаем correct с других при выборе
                if (q.format === 'single' && patch.correct) return { ...o, correct: false };
                return o;
              }
              return { ...o, ...patch };
            }),
          }
          : q
      )
    );

  const removeOption = (qid, oid) =>
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qid ? { ...q, options: q.options.filter((o) => o.id !== oid) } : q
      )
    );

  const addPair = (qid) =>
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qid
          ? { ...q, pairs: [...(q.pairs || []), { id: Date.now(), leftText: '', leftImage: '', rightText: '', rightImage: '' }] }
          : q
      )
    );

  const updatePair = (qid, pid, patch) =>
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qid
          ? { ...q, pairs: (q.pairs || []).map((p) => (p.id === pid ? { ...p, ...patch } : p)) }
          : q
      )
    );

  const removePair = (qid, pid) =>
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qid ? { ...q, pairs: (q.pairs || []).filter((p) => p.id !== pid) } : q
      )
    );

  const addOrderItem = (qid) =>
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qid
          ? { ...q, orderItems: [...(q.orderItems || []), { id: Date.now(), text: '' }] }
          : q
      )
    );

  const updateOrderItem = (qid, itemId, text) =>
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qid
          ? { ...q, orderItems: (q.orderItems || []).map((item) => item.id === itemId ? { ...item, text } : item) }
          : q
      )
    );

  const removeOrderItem = (qid, itemId) =>
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qid
          ? { ...q, orderItems: (q.orderItems || []).filter((item) => item.id !== itemId) }
          : q
      )
    );

  // Проверяем тест перед сохранением. Возвращает текст ошибки или '' если всё ок.
  const validateTest = () => {
    if (!title.trim()) return 'Введите название теста';
    if (questions.length === 0) return 'Добавьте хотя бы один вопрос';

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const num = i + 1;

      // 1. У каждого вопроса должен быть текст
      if (!q.text.trim()) {
        return `Вопрос ${num}: введите текст вопроса`;
      }

      // 2. Текстовый вопрос
      if (q.format === 'text') {
        // если это тест с баллами — нужен правильный ответ
        if (type === 'quiz' && !q.correctText.trim()) {
          return `Вопрос ${num}: укажите правильный ответ`;
        }
      } else if (q.format === 'match') {
        // 3. Вопрос на сопоставление
        const pairs = q.pairs || [];
        if (pairs.length < 2) {
          return `Вопрос ${num}: добавьте минимум 2 пары для сопоставления`;
        }
        for (let j = 0; j < pairs.length; j++) {
          const p = pairs[j];
          if (!p.leftText.trim() && !p.leftImage.trim()) {
            return `Вопрос ${num}, пара ${j + 1}: укажите левый элемент (текст или картинку)`;
          }
          if (!p.rightText.trim() && !p.rightImage.trim()) {
            return `Вопрос ${num}, пара ${j + 1}: укажите правый элемент (текст или картинку)`;
          }
        }
      } else if (q.format === 'order') {
        const items = q.orderItems || [];
        if (items.length < 2) {
          return `Вопрос ${num}: добавьте минимум 2 элемента`;
        }
        const emptyItem = items.find((item) => !item.text.trim());
        if (emptyItem) {
          return `Вопрос ${num}: заполните все элементы`;
        }
      } else {
        // 4. Вопросы с вариантами (single / multiple)
        if (q.options.length < 2) {
          return `Вопрос ${num}: добавьте минимум 2 варианта ответа`;
        }
        // ни один вариант не должен быть пустым
        const emptyOption = q.options.find((o) => !o.text.trim());
        if (emptyOption) {
          return `Вопрос ${num}: заполните все варианты ответа`;
        }
        // для теста с баллами — должен быть отмечен хотя бы один правильный
        if (type === 'quiz') {
          const hasCorrect = q.options.some((o) => o.correct);
          if (!hasCorrect) {
            return `Вопрос ${num}: отметьте правильный ответ галочкой`;
          }
        }
      }
    }
    return '';
  };

  const handleSave = () => {
    const problem = validateTest();
    if (problem) {
      setError(problem);
      // плавно прокручиваем вверх, чтобы пользователь увидел сообщение
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setError('');
    onSave({
      title: title.trim(),
      type,
      questions,
      timeLimit,
      shuffleQuestions,
      folder,
      randomCount,
    });
  };


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={onCancel} className="flex items-center text-gray-600 dark:text-gray-300 text-sm">
            <ChevronLeft className="w-5 h-5" /> Отмена
          </button>
          <span className="font-bold text-gray-800 dark:text-gray-100">{editingTest ? 'Редактирование' : 'Новый тест'}</span>
          <span className="w-16" />
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Сообщение об ошибке валидации */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
            <X className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Название */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Название теста</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="например, Тест по физике: Механика"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-gray-700 dark:text-gray-100"
          />
        </div>

        {/* Папка */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Папка (необязательно)</label>
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-gray-400" />
            <input
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="например, Физика"
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Тип теста */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Тип теста</label>
          <div className="space-y-2">
            {Object.entries(TYPE_LABELS).map(([key, meta]) => {
              const Icon = meta.icon;
              return (
                <button
                  key={key}
                  onClick={() => setType(key)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition text-left ${type === key ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
                    }`}
                >
                  <Icon className={`w-5 h-5 ${type === key ? 'text-indigo-600' : 'text-gray-400'}`} />
                  <div>
                    <div className="font-medium text-gray-800 text-sm">{meta.label}</div>
                    <div className="text-xs text-gray-500">
                      {key === 'quiz' && 'Есть правильные ответы, считаются баллы'}
                      {key === 'survey' && 'Просто собираем ответы, без оценки'}
                      {key === 'analytics' && 'Для статистики по выбранным вариантам'}
                    </div>
                  </div>
                  {type === key && <Check className="w-5 h-5 text-indigo-600 ml-auto" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Настройки теста */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm space-y-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">Настройки</label>
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <label className="text-sm text-gray-700">Таймер (минуты)</label>
              <p className="text-xs text-gray-400">0 = без ограничения</p>
            </div>
            <input
              type="number"
              min={0}
              value={timeLimit}
              onChange={(e) => setTimeLimit(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-center focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <Shuffle className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <label className="text-sm text-gray-700">Перемешивать вопросы</label>
              <p className="text-xs text-gray-400">Случайный порядок при прохождении</p>
            </div>
            <button
              onClick={() => setShuffleQuestions(!shuffleQuestions)}
              className={`w-12 h-7 rounded-full transition-colors ${shuffleQuestions ? 'bg-indigo-600' : 'bg-gray-300'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-1 ${shuffleQuestions ? 'translate-x-5' : ''}`} />
            </button>

          </div>
          <div className="flex items-center gap-3">
            <ListChecks className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <label className="text-sm text-gray-700">Сколько вопросов выдавать</label>
              <p className="text-xs text-gray-400">
                0 = все ({questions.length} шт.)
              </p>
            </div>
            <input
              type="number"
              min={0}
              max={questions.length}
              value={randomCount}
              onChange={(e) => {
                const v = parseInt(e.target.value) || 0;
                setRandomCount(Math.min(Math.max(0, v), questions.length));
              }}
              className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-center focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Вопросы */}
        {questions.map((q, idx) => (
          <QuestionEditor
            key={q.id}
            index={idx}
            question={q}
            isQuiz={type === 'quiz'}
            onUpdate={(patch) => updateQuestion(q.id, patch)}
            onRemove={() => removeQuestion(q.id)}
            onAddOption={() => addOption(q.id)}
            onUpdateOption={(oid, patch) => updateOption(q.id, oid, patch)}
            onRemoveOption={(oid) => removeOption(q.id, oid)}
            onAddPair={() => addPair(q.id)}
            onUpdatePair={(pid, patch) => updatePair(q.id, pid, patch)}
            onRemovePair={(pid) => removePair(q.id, pid)}
            onAddOrderItem={() => addOrderItem(q.id)}
            onUpdateOrderItem={(itemId, text) => updateOrderItem(q.id, itemId, text)}
            onRemoveOrderItem={(itemId) => removeOrderItem(q.id, itemId)}
          />
        ))}

        {/* Добавить вопрос */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Добавить вопрос</p>
          <div className="grid grid-cols-2 gap-2">
            <AddBtn icon={<CircleDot className="w-5 h-5" />} label="Один ответ" onClick={() => addQuestion('single')} />
            <AddBtn icon={<CheckSquare className="w-5 h-5" />} label="Несколько ответов" onClick={() => addQuestion('multiple')} />
            <AddBtn icon={<Type className="w-5 h-5" />} label="Текстовый ответ" onClick={() => addQuestion('text')} />
            <AddBtn icon={<ArrowLeftRight className="w-5 h-5" />} label="Сопоставление" onClick={() => addQuestion('match')} />
            <AddBtn icon={<GripVertical className="w-5 h-5" />} label="Порядок" onClick={() => addQuestion('order')} />
          </div>

          {/* ===== ИМПОРТ ИЗ CSV ===== */}
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <label className="flex items-center justify-center gap-2 cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-medium py-2.5 rounded-lg transition">
              <Upload className="w-4 h-4" />
              Загрузить вопросы из CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  handleCsvFile(e.target.files?.[0]);
                  e.target.value = '';   // сброс, чтобы повторно выбрать тот же файл
                }}
              />
            </label>

            {importSuccess && (
              <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <Check className="w-3.5 h-3.5" /> {importSuccess}
              </div>
            )}

            {importErrors.length > 0 && (
              <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <div className="font-medium mb-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Проблемы при импорте:
                </div>
                <ul className="list-disc list-inside space-y-0.5 max-h-32 overflow-y-auto">
                  {importErrors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
                {importErrors.length > 10 && (
                  <div className="mt-1 text-gray-500">...и ещё {importErrors.length - 10}</div>
                )}
              </div>
            )}

            <details className="mt-3 text-xs text-gray-500">
              <summary className="cursor-pointer font-medium text-gray-600">
                Формат CSV — подсказка
              </summary>
              <div className="mt-2 space-y-2">
                <p><b>Колонки:</b> <code>question, type, option1..N, correct, image, left, right, item1..N</code></p>
                <p><b>Типы:</b> single, multiple, text, match, order</p>
                <p><b>correct для single:</b> номер варианта (1, 2, ...)</p>
                <p><b>correct для multiple:</b> номера через <code>;</code>, например <code>"2;4"</code></p>
                <p><b>match:</b> по одной паре на строку, одинаковый <code>question</code> склеивает пары в один вопрос</p>
                <p><b>order:</b> правильный порядок = порядок в колонках <code>item1, item2, ...</code></p>
                <p className="text-gray-400">Скачать шаблон: <a className="text-indigo-600 underline" href="/template.csv" download>template.csv</a></p>
              </div>
            </details>
          </div>
        </div>
      </div>

      {/* Кнопка сохранить */}
      <div className="fixed bottom-0 inset-x-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-3">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleSave}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg transition"
          >
            Сохранить тест {questions.length > 0 && `(${questions.length} вопр.)`}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddBtn({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 p-3 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition"
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

const FORMAT_LABELS = {
  single: { label: 'Один ответ', icon: CircleDot },
  multiple: { label: 'Несколько ответов', icon: CheckSquare },
  text: { label: 'Текстовый ответ', icon: Type },
  match: { label: 'Сопоставление', icon: ArrowLeftRight },
  order: { label: 'Расставить по порядку', icon: GripVertical },
};

function QuestionEditor({
  index, question, isQuiz, onUpdate, onRemove,
  onAddOption, onUpdateOption, onRemoveOption,
  onAddPair, onUpdatePair, onRemovePair,
  onAddOrderItem, onUpdateOrderItem, onRemoveOrderItem,
}) {
  const meta = FORMAT_LABELS[question.format] || FORMAT_LABELS.single;
  const Icon = meta.icon;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="bg-indigo-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
            {index + 1}
          </span>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <Icon className="w-3.5 h-3.5" /> {meta.label}
          </span>
        </div>
        <button onClick={onRemove} className="text-gray-300 hover:text-red-500">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <textarea
        value={question.text}
        onChange={(e) => onUpdate({ text: e.target.value })}
        placeholder="Текст вопроса..."
        rows={2}
        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 mb-2 focus:ring-2 focus:ring-indigo-500 outline-none resize-none dark:bg-gray-700 dark:text-gray-100"
      />

      {/* Картинка к вопросу */}
      <div className="flex items-center gap-2 mb-2">
        <input
          value={question.image}
          onChange={(e) => onUpdate({ image: e.target.value })}
          placeholder="Ссылка на картинку (или загрузите файл)"
          className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-gray-700 dark:text-gray-100"
        />
        <label className="flex-shrink-0 cursor-pointer bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg p-2 transition" title="Загрузить картинку">
          <Upload className="w-4 h-4 text-gray-500" />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 2 * 1024 * 1024) { alert('Файл слишком большой (макс. 2 МБ)'); return; }
              const reader = new FileReader();
              reader.onload = (ev) => onUpdate({ image: ev.target.result });
              reader.readAsDataURL(file);
            }}
          />
        </label>
      </div>
      {question.image && (
        <img src={question.image} alt="" className="w-full rounded-lg mb-2 max-h-32 object-cover bg-gray-100 dark:bg-gray-700"
          onError={(e) => (e.target.style.display = 'none')} />
      )}

      {/* Обязательный вопрос */}
      <label className="flex items-center gap-2 mb-3 cursor-pointer">
        <button
          type="button"
          onClick={() => onUpdate({ required: !question.required })}
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
            question.required ? 'bg-red-500 border-red-500' : 'border-gray-300'
          }`}
        >
          {question.required && <Check className="w-3.5 h-3.5 text-white" />}
        </button>
        <span className="text-sm text-gray-600">Обязательный вопрос</span>
        {question.required && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
      </label>

      {question.format === 'order' ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Расположите элементы в правильном порядке (сверху вниз)</p>
          {(question.orderItems || []).map((item, idx) => (
            <div key={item.id} className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 w-5">{idx + 1}.</span>
              <input
                value={item.text}
                onChange={(e) => onUpdateOrderItem(item.id, e.target.value)}
                placeholder={`Элемент ${idx + 1}`}
                className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-gray-700 dark:text-gray-100"
              />
              {(question.orderItems || []).length > 2 && (
                <button onClick={() => onRemoveOrderItem(item.id)} className="text-gray-300 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <button onClick={onAddOrderItem} className="text-sm text-indigo-600 font-medium flex items-center gap-1 mt-1">
            <Plus className="w-4 h-4" /> Добавить элемент
          </button>
        </div>
      ) : question.format === 'match' ? (
        /* ===== СОПОСТАВЛЕНИЕ ===== */
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1 text-center">
            <div className="text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-md py-1">Левый элемент</div>
            <div className="text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-md py-1">Правый элемент</div>
          </div>
          {(question.pairs || []).map((pair, pairIdx) => (
            <div key={pair.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-400">Пара {pairIdx + 1}</span>
                {(question.pairs || []).length > 2 && (
                  <button onClick={() => onRemovePair(pair.id)} className="text-gray-300 hover:text-red-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <input
                    value={pair.leftText}
                    onChange={(e) => onUpdatePair(pair.id, { leftText: e.target.value })}
                    placeholder="Текст"
                    className="w-full border border-indigo-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
                  />
                  <input
                    value={pair.leftImage}
                    onChange={(e) => onUpdatePair(pair.id, { leftImage: e.target.value })}
                    placeholder="Ссылка на картинку"
                    className="w-full border border-gray-200 rounded-md px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-400 outline-none bg-white text-gray-500"
                  />
                  {pair.leftImage && (
                    <img src={pair.leftImage} alt="" className="w-full rounded max-h-16 object-cover bg-gray-100"
                      onError={(e) => (e.target.style.display = 'none')} />
                  )}
                </div>
                <div className="space-y-1.5">
                  <input
                    value={pair.rightText}
                    onChange={(e) => onUpdatePair(pair.id, { rightText: e.target.value })}
                    placeholder="Текст"
                    className="w-full border border-emerald-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-emerald-500 outline-none bg-white"
                  />
                  <input
                    value={pair.rightImage}
                    onChange={(e) => onUpdatePair(pair.id, { rightImage: e.target.value })}
                    placeholder="Ссылка на картинку"
                    className="w-full border border-gray-200 rounded-md px-2 py-1 text-xs focus:ring-1 focus:ring-emerald-400 outline-none bg-white text-gray-500"
                  />
                  {pair.rightImage && (
                    <img src={pair.rightImage} alt="" className="w-full rounded max-h-16 object-cover bg-gray-100"
                      onError={(e) => (e.target.style.display = 'none')} />
                  )}
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={onAddPair}
            className="text-sm text-indigo-600 font-medium flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Добавить пару
          </button>
          <p className="text-xs text-gray-400">
            При прохождении правые элементы будут перемешаны в случайном порядке
          </p>
        </div>
      ) : question.format === 'text' ? (
        /* ===== ТЕКСТОВЫЙ ОТВЕТ ===== */
        isQuiz ? (
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Правильный ответ
            </label>
            <input
              value={question.correctText}
              onChange={(e) => onUpdate({ correctText: e.target.value })}
              placeholder="например, 9.8"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">
            Пользователь введёт ответ текстом
          </p>
        )
      ) : (
        /* ===== ВЫБОР ВАРИАНТОВ (single / multiple) ===== */
        <div className="space-y-2">
          {question.options.map((o) => (
            <div key={o.id} className="flex items-center gap-2">
              {isQuiz && (
                <button
                  onClick={() => onUpdateOption(o.id, { correct: !o.correct })}
                  className={`flex-shrink-0 w-6 h-6 rounded-${question.format === 'single' ? 'full' : 'md'} border-2 flex items-center justify-center ${o.correct ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}
                  title="Отметить правильным"
                >
                  {o.correct && <Check className="w-4 h-4 text-white" />}
                </button>
              )}
              <input
                value={o.text}
                onChange={(e) => onUpdateOption(o.id, { text: e.target.value })}
                placeholder="Вариант ответа"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              {question.options.length > 1 && (
                <button onClick={() => onRemoveOption(o.id)} className="text-gray-300 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={onAddOption}
            className="text-sm text-indigo-600 font-medium flex items-center gap-1 mt-1"
          >
            <Plus className="w-4 h-4" /> Добавить вариант
          </button>
          {isQuiz && (
            <p className="text-xs text-gray-400 mt-1">
              Отметьте {question.format === 'single' ? 'правильный вариант' : 'правильные варианты'} галочкой
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ============ ПРОХОЖДЕНИЕ ТЕСТА ============ */

function TestTaking({ test, onCancel, onSubmit }) {
  const [name, setName] = useState('');
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [requiredError, setRequiredError] = useState('');
  const [nameError, setNameError] = useState('');
  const [displayQuestions] = useState(() => {
    let qs = [...test.questions];
    const n = test.randomCount || 0;
    if (n > 0 && n < qs.length) {
      for (let i = qs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [qs[i], qs[j]] = [qs[j], qs[i]];
      }
      qs = qs.slice(0, n);
    } else if (test.shuffleQuestions) {
      for (let i = qs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [qs[i], qs[j]] = [qs[j], qs[i]];
      }
    }
    return qs;
  });

  useEffect(() => {
    if (!started) return;
    if (timeLeft === null || timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [started, timeLeft]);
  const setAnswer = (qid, patch) =>
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], ...patch } }));

  const toggleOption = (q, oid) => {
    const cur = answers[q.id]?.selected || [];
    if (q.format === 'single') {
      setAnswer(q.id, { selected: [oid] });
    } else {
      setAnswer(q.id, {
        selected: cur.includes(oid) ? cur.filter((x) => x !== oid) : [...cur, oid],
      });
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

    const doSubmit = useCallback((force = false) => {
    if (!force) {
      const unanswered = displayQuestions.filter((q) => {
        if (!q.required) return false;
        const a = answers[q.id] || {};
        if (q.format === 'match') return Object.keys(a.matches || {}).length === 0;
        if (q.format === 'order') return (a.orderItems || []).length === 0;
        if (q.format === 'text') return !(a.text && a.text.trim());
        return (a.selected || []).length === 0;
      });
      if (unanswered.length > 0) {
        const idx = displayQuestions.indexOf(unanswered[0]) + 1;
        setRequiredError(`Ответьте на обязательный вопрос ${idx}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }
    setRequiredError('');

    let score = 0;
    let answered = 0;
    const detailed = displayQuestions.map((q) => {
      const a = answers[q.id] || {};
      let correct = null;

    if (q.format === 'order') {
      const userItems = a.orderItems || [];
      if (userItems.length > 0) answered++;
      if (test.type === 'quiz') {
        const correctOrder = (q.orderItems || []).map((item) => item.id);
        const userOrderIds = userItems.map((item) => item.id);
        correct = JSON.stringify(correctOrder) === JSON.stringify(userOrderIds);
        if (correct) score++;
      }
      return { qid: q.id, selected: [], text: '', correct, matches: {}, orderItems: userItems };
    }

    if (q.format === 'match') {
      const userMatches = a.matches || {};
      if (Object.keys(userMatches).length > 0) answered++;
      if (test.type === 'quiz') {
        const pairs = q.pairs || [];
        correct = pairs.length > 0 && pairs.every((p) => userMatches[p.id] === p.id);
        if (correct) score++;
      }
      return { qid: q.id, selected: [], text: '', correct, matches: userMatches };
    }

    if (q.format === 'text') {
      if (a.text && a.text.trim()) answered++;
    } else {
      if ((a.selected || []).length > 0) answered++;
    }

      if (test.type === 'quiz') {
        if (q.format === 'text') {
          correct = (a.text || '').trim().toLowerCase() === (q.correctText || '').trim().toLowerCase();
        } else {
          const correctIds = q.options.filter((o) => o.correct).map((o) => o.id).sort();
          const sel = [...(a.selected || [])].sort();
          correct = JSON.stringify(correctIds) === JSON.stringify(sel);
        }
        if (correct) score++;
      }
      return { qid: q.id, selected: a.selected || [], text: a.text || '', correct, matches: {} };
    });

    onSubmit({
      id: Date.now(),
      name: name.trim(),
      score,
      total: displayQuestions.length,
      answered,
      skipped: displayQuestions.length - answered,
      detailed,
      at: new Date().toLocaleString('ru-RU'),
    });
  }, [answers, name, displayQuestions, test.type, onSubmit]);

  const autoSubmitRef = React.useRef(false);
  useEffect(() => {
    if (timeLeft === 0 && started && !autoSubmitRef.current) {
      autoSubmitRef.current = true;
      doSubmit(true);
    }
  }, [timeLeft, started, doSubmit]);


  if (!started) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg w-full max-w-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">{test.title}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
  {test.randomCount && test.randomCount < test.questions.length
    ? `${test.randomCount} из ${test.questions.length} вопросов`
    : `${test.questions.length} вопросов`}
</p>
          {test.timeLimit > 0 && (
            <p className="text-sm text-amber-600 flex items-center gap-1 mb-1">
              <Clock className="w-4 h-4" /> Ограничение: {test.timeLimit} мин.
            </p>
          )}
          {test.shuffleQuestions && (
            <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
              <Shuffle className="w-3 h-3" /> Вопросы будут перемешаны
            </p>
          )}
          <div className="mb-4" />
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Ваш ID</label>
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError(''); }}
            placeholder="Введите ваш ID"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 mb-2 focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-gray-700 dark:text-gray-100"
          />
          {nameError && (
            <p className="text-xs text-red-500 mb-2">{nameError}</p>
          )}
          <button
            onClick={() => {
              if (!name.trim()) {
                setNameError('Введите ваш ID');
                return;
              }
              if (test.timeLimit > 0) setTimeLeft(test.timeLimit * 60);
              setStarted(true);
            }}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg mb-2"
          >
            Начать
          </button>
          <button onClick={onCancel} className="w-full text-gray-500 text-sm py-2">
            Отмена
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={onCancel} className="text-gray-600 dark:text-gray-300 text-sm flex items-center">
            <ChevronLeft className="w-5 h-5" /> Выйти
          </button>
          <span className="font-bold text-gray-800 dark:text-gray-100 truncate px-2">{test.title}</span>
          {timeLeft !== null ? (
            <span className={`text-sm font-mono font-bold flex items-center gap-1 ${timeLeft <= 60 ? 'text-red-600' : timeLeft <= 300 ? 'text-amber-600' : 'text-gray-600'}`}>
              <Clock className="w-4 h-4" /> {formatTime(timeLeft)}
            </span>
          ) : (
            <span className="w-12" />
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {requiredError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {requiredError}
          </div>
        )}
        {displayQuestions.map((q, idx) => {
          const a = answers[q.id] || {};
          return (
            <div key={q.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-start gap-2 mb-3">
                <span className="bg-indigo-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">
                  {idx + 1}
                </span>
                <p className="font-medium text-gray-800 dark:text-gray-100">
                  {q.text || '(вопрос без текста)'}
                  {q.required && <span className="text-red-500 ml-1">*</span>}
                </p>
              </div>

              {q.image && (
                <img
                  src={q.image}
                  alt=""
                  className="w-full rounded-lg mb-3 max-h-48 object-cover bg-gray-100"
                  onError={(e) => (e.target.style.display = 'none')}
                />
              )}

              {q.format === 'order' ? (
                <OrderTaking
                  question={q}
                  userOrder={a.orderItems || null}
                  onReorder={(newOrder) => setAnswer(q.id, { orderItems: newOrder })}
                />
              ) : q.format === 'match' ? (
                <MatchTaking
                  question={q}
                  matches={a.matches || {}}
                  onMatch={(leftId, rightId) => {
                    const current = answers[q.id]?.matches || {};
                    const updated = { ...current };
                    // Снимаем если тот же правый элемент был сопоставлен другому левому
                    Object.keys(updated).forEach((key) => {
                      if (updated[key] === rightId) delete updated[key];
                    });
                    // Переключаем: повторный клик по тому же правому — снимает сопоставление
                    if (current[leftId] === rightId) {
                      delete updated[leftId];
                    } else {
                      updated[leftId] = rightId;
                    }
                    setAnswer(q.id, { matches: updated });
                  }}
                />
              ) : q.format === 'text' ? (
                <input
                  value={a.text || ''}
                  onChange={(e) => setAnswer(q.id, { text: e.target.value })}
                  placeholder="Ваш ответ..."
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-gray-700 dark:text-gray-100"
                />
              ) : (
                <div className="space-y-2">
                  {q.options.map((o) => {
                    const sel = (a.selected || []).includes(o.id);
                    return (
                      <button
                        key={o.id}
                        onClick={() => toggleOption(q, o.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition ${sel ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}
                      >
                        <div
                          className={`w-5 h-5 flex-shrink-0 border-2 flex items-center justify-center ${q.format === 'single' ? 'rounded-full' : 'rounded-md'} ${sel ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'}`}
                        >
                          {sel && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <span className="text-sm text-gray-700">{o.text || '(пусто)'}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-3">
        <div className="max-w-md mx-auto">
          <button
            onClick={() => doSubmit(false)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" /> Отправить ответы
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ СОПОСТАВЛЕНИЕ (прохождение) ============ */

function MatchTaking({ question, matches, onMatch }) {
  const [activeLeftId, setActiveLeftId] = useState(null);

  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

  // Перемешиваем правые элементы один раз при монтировании
  const [shuffledRights] = useState(() => {
    const rights = (question.pairs || []).map((p) => ({
      id: p.id,
      text: p.rightText,
      image: p.rightImage,
    }));
    for (let i = rights.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rights[i], rights[j]] = [rights[j], rights[i]];
    }
    return rights;
  });

  // rightId → буква (A, B, C, ...)
  const rightLabel = {};
  shuffledRights.forEach((r, i) => { rightLabel[r.id] = LETTERS[i] || String(i + 1); });

  const matchedRightIds = new Set(Object.values(matches));

  const getMatchedRight = (leftId) => {
    const rightId = matches[leftId];
    return rightId != null ? shuffledRights.find((r) => r.id === rightId) : null;
  };

  const handleLeftClick = (leftId) => {
    setActiveLeftId((prev) => (prev === leftId ? null : leftId));
  };

  const handleRightClick = (rightId) => {
    if (activeLeftId == null) return;
    onMatch(activeLeftId, rightId);
    setActiveLeftId(null);
  };

  const pairs = question.pairs || [];
  const allMatched = pairs.length > 0 && pairs.every((p) => matches[p.id] != null);

  // Кто из левых сейчас активен — его порядковый номер
  const activeNum = activeLeftId != null ? pairs.findIndex((p) => p.id === activeLeftId) + 1 : null;

  return (
    <div>
      {/* Подсказка */}
      <div className={`text-xs text-center py-1.5 px-3 rounded-lg mb-3 font-medium ${
        activeLeftId != null
          ? 'bg-indigo-50 text-indigo-700'
          : allMatched
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-gray-50 text-gray-500'
      }`}>
        {activeLeftId != null
          ? `Выбрано: ${activeNum} — выберите букву в правом столбце`
          : allMatched
          ? 'Все элементы сопоставлены. Нажмите чтобы изменить.'
          : 'Нажмите цифру слева, затем букву справа'}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Левый столбец — цифры */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-indigo-600 text-center py-1 bg-indigo-50 rounded-md">
            Левый столбец
          </div>
          {pairs.map((pair, idx) => {
            const matched = getMatchedRight(pair.id);
            const isActive = activeLeftId === pair.id;
            const num = idx + 1;
            return (
              <button
                key={pair.id}
                onClick={() => handleLeftClick(pair.id)}
                className={`w-full p-2 rounded-lg border-2 text-left transition ${
                  isActive
                    ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                    : matched
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-gray-200 hover:border-indigo-300 bg-white'
                }`}
              >
                <div className="flex items-start gap-1.5">
                  {/* Порядковый номер */}
                  <span className={`flex-shrink-0 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${
                    isActive ? 'bg-indigo-500 text-white' : matched ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {num}
                  </span>
                  <div className="flex-1 min-w-0">
                    {pair.leftImage && (
                      <img src={pair.leftImage} alt="" className="w-full rounded mb-1 max-h-20 object-cover bg-gray-100"
                        onError={(e) => (e.target.style.display = 'none')} />
                    )}
                    {pair.leftText && (
                      <span className="font-medium text-gray-800 text-xs leading-snug block">{pair.leftText}</span>
                    )}
                    {matched && (
                      <div className="mt-1 text-xs text-emerald-700 border-t border-emerald-200 pt-1 leading-snug flex items-center gap-1">
                        <span className="font-bold">→ {rightLabel[matched.id]}</span>
                        {matched.text && <span className="text-emerald-600">({matched.text})</span>}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Правый столбец — буквы */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-emerald-600 text-center py-1 bg-emerald-50 rounded-md">
            Правый столбец
          </div>
          {shuffledRights.map((right, idx) => {
            const label = LETTERS[idx] || String(idx + 1);
            const isUsed = matchedRightIds.has(right.id);
            const isSelectable = activeLeftId != null;
            return (
              <button
                key={right.id}
                onClick={() => handleRightClick(right.id)}
                className={`w-full p-2 rounded-lg border-2 text-left transition ${
                  isUsed
                    ? 'border-emerald-400 bg-emerald-50'
                    : isSelectable
                    ? 'border-indigo-200 bg-white hover:border-indigo-400 hover:bg-indigo-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start gap-1.5">
                  {/* Буква */}
                  <span className={`flex-shrink-0 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${
                    isUsed ? 'bg-emerald-500 text-white' : isSelectable ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {label}
                  </span>
                  <div className="flex-1 min-w-0">
                    {right.image && (
                      <img src={right.image} alt="" className="w-full rounded mb-1 max-h-20 object-cover bg-gray-100"
                        onError={(e) => (e.target.style.display = 'none')} />
                    )}
                    {right.text && (
                      <span className="font-medium text-gray-800 text-xs leading-snug block">{right.text}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}


/* ============ ПОРЯДОК (прохождение) ============ */

function OrderTaking({ question, userOrder, onReorder }) {
  const [items, setItems] = useState(() => {
    if (userOrder) return userOrder;
    const shuffled = [...(question.orderItems || [])];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  });

  const move = (index, direction) => {
    const newItems = [...items];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= newItems.length) return;
    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
    setItems(newItems);
    onReorder(newItems);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 dark:text-gray-400">Расставьте элементы в правильном порядке</p>
      {items.map((item, idx) => (
        <div key={item.id} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 rounded-lg p-2 border border-gray-200 dark:border-gray-600">
          <span className="text-xs font-bold text-gray-400 w-5">{idx + 1}.</span>
          <span className="flex-1 text-sm text-gray-700 dark:text-gray-200">{item.text}</span>
          <div className="flex flex-col">
            <button
              onClick={() => move(idx, -1)}
              disabled={idx === 0}
              className="text-gray-400 hover:text-indigo-600 disabled:opacity-30"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => move(idx, 1)}
              disabled={idx === items.length - 1}
              className="text-gray-400 hover:text-indigo-600 disabled:opacity-30"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}


/* ============ РЕЗУЛЬТАТЫ ============ */

function TestResults({ test, onBack, onDeleteSubmission }) {
  const subs = test.submissions;
  const [openSub, setOpenSub] = useState(null);

  const avgScore =
    test.type === 'quiz' && subs.length
      ? (subs.reduce((sum, s) => sum + s.score, 0) / subs.length).toFixed(1)
      : null;

  const exportCSV = () => {
    if (subs.length === 0) return;
    const sep = ';';
    const headers = ['Имя', 'Дата'];
    if (test.type === 'quiz') {
      headers.push('Баллы', 'Всего', 'Отвечено', 'Пропущено');
    } else {
      headers.push('Отвечено', 'Пропущено');
    }

    // собираем qid, которые реально кто-то видел
    const seenQids = new Set();
    subs.forEach((s) => (s.detailed || []).forEach((d) => seenQids.add(d.qid)));

    // оставляем порядок как в test.questions
    const servedQuestions = test.questions.filter((q) => seenQids.has(q.id));

    servedQuestions.forEach((q, i) => headers.push(`В${i + 1}: ${q.text}`));

    const rows = subs.map((s) => {
      const row = [s.name, s.at];
      if (test.type === 'quiz') {
        row.push(s.score, s.total, s.answered, s.skipped);
      } else {
        row.push(s.answered, s.skipped);
      }
      servedQuestions.forEach((q) => {
        const d = (s.detailed || []).find((x) => x.qid === q.id)
        if (!d) { row.push(''); return; }
        if (q.format === 'text') {
          row.push(d.text || '');
        } else if (q.format === 'match') {
          const pairs = q.pairs || [];
          const parts = pairs.map((p) => {
            const matchedPair = pairs.find((pp) => pp.id === (d.matches || {})[p.id]);
            return `${p.leftText}→${matchedPair ? matchedPair.rightText : '?'}`;
          });
          row.push(parts.join(', '));
        } else {
          const selected = (q.options || [])
            .filter((o) => (d.selected || []).includes(o.id))
            .map((o) => o.text);
          row.push(selected.join(', '));
        }
      });
      return row;
    });

    const escape = (v) => {
      const str = String(v ?? '');
      if (str.includes(sep) || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const csv = '﻿' + [headers, ...rows].map((r) => r.map(escape).join(sep)).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${test.title} - результаты.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={onBack} className="text-gray-600 dark:text-gray-300 text-sm flex items-center">
            <ChevronLeft className="w-5 h-5" /> Назад
          </button>
          <span className="font-bold text-gray-800 dark:text-gray-100">Результаты</span>
          <span className="w-12" />
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-gray-800 dark:text-gray-100">{test.title}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {TYPE_LABELS[test.type].label} · {test.questions.length} вопросов
            {test.randomCount > 0 && ` (выдаётся ${test.randomCount})`}
          </p>

          {/* Сводные показатели */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-indigo-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-indigo-600">{subs.length}</div>
              <div className="text-xs text-gray-500">
                {test.type === 'quiz' ? 'прохождений' : 'опрошено человек'}
              </div>
            </div>
            {test.type === 'quiz' && subs.length > 0 && (
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-emerald-600">
                  {avgScore ?? '—'}
                 {avgScore && (
                    <span className="text-sm text-gray-400">
                      /{subs[0]?.total || test.questions.length}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">средний балл</div>
              </div>
            )}
          </div>

          {subs.length > 0 && (
            <button
              onClick={exportCSV}
              className="w-full mt-3 flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-medium py-2.5 rounded-lg transition"
            >
              <Download className="w-4 h-4" /> Экспорт в Excel (CSV)
            </button>
          )}
        </div>

        {subs.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center text-gray-400">
            <ListChecks className="w-10 h-10 mx-auto mb-2 opacity-50" />
            Пока никто не проходил тест
          </div>
        ) : (
          <>
            {/* Список прохождений */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 text-xs font-semibold text-gray-500 uppercase">
                Прохождения
              </div>
              {subs.map((s) => (
                <div key={s.id} className="border-t border-gray-100">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-800 text-sm">{s.name}</div>
                      <div className="text-xs text-gray-400">{s.at}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        {test.type === 'quiz' ? (
                          <span className="font-bold text-indigo-600">
                            {s.score}/{s.total}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">{s.answered} отв.</span>
                        )}
                        <div className="text-xs text-gray-400">пропущ.: {s.skipped}</div>
                      </div>
                      {/* Кнопка разбора — только для теста с баллами */}
                      {test.type === 'quiz' && (
                        <button
                          onClick={() => setOpenSub(openSub === s.id ? null : s.id)}
                          className="text-xs text-indigo-600 font-medium border border-indigo-200 rounded-lg px-2 py-1 hover:bg-indigo-50"
                        >
                          {openSub === s.id ? 'Скрыть' : 'Разбор'}
                        </button>
                      )}
                      {/* Удалить только это прохождение */}
                      <button
                        onClick={() => {
                          if (window.confirm(`Удалить результат «${s.name}»? Сам тест останется.`)) {
                            onDeleteSubmission(s.id);
                          }
                        }}
                        className="text-gray-300 hover:text-red-500 p-1"
                        title="Удалить этот результат"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Развёрнутый разбор ответов */}
                  {test.type === 'quiz' && openSub === s.id && (
                    <div className="px-4 pb-3 space-y-3 bg-gray-50">
                      {test.questions
                        .filter((q) => s.detailed.find((d) => d.qid === q.id))
                        .map((q, idx) => (
                          <AnswerReview key={q.id} q={q} idx={idx} detail={s.detailed.find((d) => d.qid === q.id)} />
                        ))
                      }
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Аналитика по вопросам (для analytics/survey) */}
            {(test.type === 'analytics' || test.type === 'survey') && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm space-y-4">
                <div className="text-xs font-semibold text-gray-500 uppercase">
                  Сводка по ответам
                </div>
              {test.questions
                .filter((q) => subs.some((s) => s.detailed.some((d) => d.qid === q.id)))
                .map((q, idx) => (
                  <QuestionStats key={q.id} q={q} idx={idx} subs={subs} />
                ))
              }
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AnswerReview({ q, idx, detail }) {
  if (!detail) return null;

  const isCorrect = detail.correct === true;
  const isWrong = detail.correct === false;

  const indicator = (
    <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
      isCorrect ? 'bg-emerald-500' : isWrong ? 'bg-red-500' : 'bg-gray-300'
    }`}>
      {isCorrect ? <Check className="w-3 h-3 text-white" /> : isWrong ? <X className="w-3 h-3 text-white" /> : null}
    </span>
  );

  // ===== ПОРЯДОК =====
  if (q.format === 'order') {
    const userItems = detail.orderItems || [];
    const correctItems = q.orderItems || [];
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
        <div className="flex items-start gap-2 mb-2">
          {indicator}
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
            {idx + 1}. {q.text || '(вопрос без текста)'}
          </p>
        </div>
        <div className="ml-7 space-y-1">
          {userItems.map((item, i) => {
            const isRight = correctItems[i] && correctItems[i].id === item.id;
            return (
              <div key={item.id} className={`text-xs rounded-md px-2 py-1.5 ${isRight ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {i + 1}. {item.text} {!isRight && correctItems[i] && <span className="text-gray-400 ml-1">(правильно: {correctItems[i].text})</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ===== СОПОСТАВЛЕНИЕ =====
  if (q.format === 'match') {
    const userMatches = detail.matches || {};
    const pairs = q.pairs || [];
    const correctCount = pairs.filter((p) => userMatches[p.id] === p.id).length;
    return (
      <div className="bg-white rounded-lg p-3 border border-gray-100">
        <div className="flex items-start gap-2 mb-2">
          {indicator}
          <p className="text-sm font-medium text-gray-800">
            {idx + 1}. {q.text || '(вопрос без текста)'}
          </p>
        </div>
        <div className="ml-7 space-y-1">
          {pairs.map((pair) => {
            const userRightId = userMatches[pair.id];
            const matchedPair = pairs.find((p) => p.id === userRightId);
            const isPairOk = userRightId === pair.id;
            return (
              <div key={pair.id} className={`text-xs rounded-md px-2 py-1.5 ${
                isPairOk ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}>
                <span className="font-medium">{pair.leftText || '🖼'}</span>
                {' → '}
                <span className="font-medium">
                  {matchedPair ? (matchedPair.rightText || '🖼') : '(не выбрано)'}
                </span>
                {!isPairOk && (
                  <span className="text-gray-400 ml-1">
                    (правильно: {pair.rightText || '🖼'})
                  </span>
                )}
              </div>
            );
          })}
          <div className="text-xs text-gray-500 mt-1">
            Верных пар: {correctCount} из {pairs.length}
          </div>
        </div>
      </div>
    );
  }

  // ===== ТЕКСТ / ВАРИАНТЫ =====
  let userAnswer;
  let correctAnswer;

  if (q.format === 'text') {
    userAnswer = detail.text?.trim() || '(пусто)';
    correctAnswer = q.correctText;
  } else {
    const selectedTexts = (q.options || [])
      .filter((o) => (detail.selected || []).includes(o.id))
      .map((o) => o.text || '(пусто)');
    userAnswer = selectedTexts.length ? selectedTexts.join(', ') : '(не отвечено)';
    correctAnswer = (q.options || [])
      .filter((o) => o.correct)
      .map((o) => o.text || '(пусто)')
      .join(', ');
  }

  return (
    <div className="bg-white rounded-lg p-3 border border-gray-100">
      <div className="flex items-start gap-2 mb-1">
        {indicator}
        <p className="text-sm font-medium text-gray-800">
          {idx + 1}. {q.text || '(вопрос без текста)'}
        </p>
      </div>
      <div className="ml-7 space-y-0.5 text-xs">
        <div className={isCorrect ? 'text-emerald-700' : 'text-red-700'}>
          Ответ: <span className="font-medium">{userAnswer}</span>
        </div>
        {isWrong && (
          <div className="text-gray-500">
            Правильно: <span className="font-medium text-emerald-700">{correctAnswer}</span>
          </div>
        )}
      </div>
    </div>
  );
}


function QuestionStats({ q, idx, subs }) {
  const total = subs.length;

  if (q.format === 'text') {
    const texts = subs
      .map((s) => s.detailed.find((d) => d.qid === q.id)?.text)
      .filter((t) => t && t.trim());
    return (
      <div>
        <p className="font-medium text-gray-800 text-sm mb-1">
          {idx + 1}. {q.text}
        </p>
        <div className="space-y-1">
          {texts.length === 0 ? (
            <p className="text-xs text-gray-400">Нет ответов</p>
          ) : (
            texts.map((t, i) => (
              <div key={i} className="text-sm text-gray-600 bg-gray-50 rounded px-2 py-1">
                {t}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (q.format === 'order') {
    const correctOrder = (q.orderItems || []).map(item => item.id);
    const correctCount = subs.filter(s => {
      const d = s.detailed.find(d => d.qid === q.id);
      if (!d || !d.orderItems) return false;
      return JSON.stringify(d.orderItems.map(i => i.id)) === JSON.stringify(correctOrder);
    }).length;
    const pct = total ? Math.round((correctCount / total) * 100) : 0;
    return (
      <div>
        <p className="font-medium text-gray-800 dark:text-gray-100 text-sm mb-2">{idx + 1}. {q.text}</p>
        <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">
          Правильный порядок: {correctCount} из {total} ({pct}%)
        </div>
        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  if (q.format === 'match') {
    const pairs = q.pairs || [];
    return (
      <div>
        <p className="font-medium text-gray-800 text-sm mb-2">
          {idx + 1}. {q.text}
        </p>
        <div className="space-y-1.5">
          {pairs.map((pair) => {
            const count = subs.filter((s) => {
              const detail = s.detailed.find((d) => d.qid === q.id);
              return detail?.matches?.[pair.id] === pair.id;
            }).length;
            const pct = total ? Math.round((count / total) * 100) : 0;
            return (
              <div key={pair.id}>
                <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                  <span>{pair.leftText || '🖼'} → {pair.rightText || '🖼'}</span>
                  <span>{count} ({pct}%)</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="font-medium text-gray-800 text-sm mb-2">
        {idx + 1}. {q.text}
      </p>
      <div className="space-y-1.5">
        {(q.options || []).map((o) => {
          const count = subs.filter((s) =>
            s.detailed.find((d) => d.qid === q.id)?.selected?.includes(o.id)
          ).length;
          const pct = total ? Math.round((count / total) * 100) : 0;
          return (
            <div key={o.id}>
              <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                <span>{o.text || '(пусто)'}</span>
                <span>{count} ({pct}%)</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function plural(n) {
  const forms = ['тест', 'теста', 'тестов'];
  const n100 = n % 100;
  const n10 = n % 10;
  if (n100 >= 11 && n100 <= 14) return forms[2];
  if (n10 === 1) return forms[0];
  if (n10 >= 2 && n10 <= 4) return forms[1];
  return forms[2];
}


/* ============ АВТОРИЗАЦИЯ ============ */

function AuthScreen({ onAuth }) {
  // mode: login | register | code | reset-email | reset-code
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => { setError(''); setInfo(''); };

  // --- Вход ---
  const doLogin = async () => {
    reset();
    if (!login.trim() || !password) { setError('Введите логин и пароль'); return; }
    setLoading(true);
    try {
      const data = await loginUser(login.trim(), password);
      onAuth(data);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  // --- Регистрация: шаг 1 (отправить код) ---
  const doRegisterStart = async () => {
    reset();
    if (!email.trim() || !login.trim() || !password) {
      setError('Заполните все поля'); return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Введите корректный адрес почты'); return;
    }
    if (login.trim().length < 3) {
      setError('Логин минимум 3 символа'); return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(login.trim())) {
      setError('Логин может содержать только латинские буквы, цифры и знак _'); return;
    }
    if (password.length < 6) { setError('Пароль минимум 6 символов'); return; }
    setLoading(true);
    try {
      await registerStart(email.trim(), login.trim(), password);
      setInfo('Код отправлен на почту');
      setMode('code');
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  // --- Регистрация: шаг 2 (подтвердить код) ---
  const doRegisterConfirm = async () => {
    reset();
    if (!code.trim()) { setError('Введите код из письма'); return; }
    setLoading(true);
    try {
      const data = await registerConfirm(email.trim(), code.trim());
      onAuth(data);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  // --- Сброс: шаг 1 (отправить код) ---
  const doResetStart = async () => {
    reset();
    if (!email.trim()) { setError('Введите почту'); return; }
    setLoading(true);
    try {
      await resetStart(email.trim());
      setInfo('Если почта зарегистрирована, код отправлен');
      setMode('reset-code');
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  // --- Сброс: шаг 2 (новый пароль) ---
  const doResetConfirm = async () => {
    reset();
    if (!code.trim() || !newPassword) { setError('Введите код и новый пароль'); return; }
    if (newPassword.length < 6) { setError('Пароль минимум 6 символов'); return; }
    setLoading(true);
    try {
      const data = await resetConfirm(email.trim(), code.trim(), newPassword);
      onAuth(data);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  // --- Напомнить логин ---
  const doForgotLogin = async () => {
    reset();
    if (!email.trim()) { setError('Введите почту'); return; }
    setLoading(true);
    try {
      await forgotLogin(email.trim());
      setInfo('Если почта зарегистрирована, логин отправлен на неё');
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const inputCls =
    'w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none';

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-600 to-indigo-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        {/* Шапка */}
        <div className="flex flex-col items-center mb-5">
          <div className="bg-indigo-100 rounded-full p-4 mb-3">
            <ClipboardList className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">Конструктор тестов</h1>
          <p className="text-sm text-gray-500 mt-1 text-center">
            {mode === 'login' && 'Войдите в свой аккаунт'}
            {mode === 'register' && 'Создание аккаунта'}
            {mode === 'code' && 'Подтверждение почты'}
            {mode === 'reset-email' && 'Восстановление пароля'}
            {mode === 'reset-code' && 'Новый пароль'}
          </p>
        </div>

        {/* Сообщения */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
            <X className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}
        {info && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
            <Check className="w-4 h-4 flex-shrink-0" /> {info}
          </div>
        )}

        {/* ===== ВХОД ===== */}
        {mode === 'login' && (
          <>
            <div className="relative mb-3">
              <User className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
              <input value={login} onChange={(e) => setLogin(e.target.value)}
                placeholder="Логин или почта" className={inputCls} />
            </div>
            <div className="mb-1">
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Пароль"
                autoComplete="current-password"
              />
            </div>
            <button onClick={() => { reset(); setMode('reset-email'); }}
              className="text-xs text-indigo-600 mb-4 block ml-auto mt-2">
              Забыли пароль или логин?
            </button>
            <button onClick={doLogin} disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-medium py-2.5 rounded-lg mb-3">
              {loading ? 'Вход...' : 'Войти'}
            </button>
            <p className="text-center text-sm text-gray-500">
              Нет аккаунта?{' '}
              <button onClick={() => { reset(); setMode('register'); }}
                className="text-indigo-600 font-medium">Зарегистрироваться</button>
            </p>
          </>
        )}

        {/* ===== РЕГИСТРАЦИЯ ===== */}
        {mode === 'register' && (
          <>
            <div className="relative mb-3">
              <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
              <input value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Электронная почта" className={inputCls} />
            </div>
            <div className="relative mb-3">
              <User className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
              <input value={login} onChange={(e) => setLogin(e.target.value)}
                placeholder="Придумайте логин" className={inputCls} />
            </div>
            <div className="mb-4">
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Пароль (минимум 6 символов)"
                autoComplete="new-password"
              />
            </div>
            <button onClick={doRegisterStart} disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-medium py-2.5 rounded-lg mb-3">
              {loading ? 'Отправка...' : 'Получить код'}
            </button>
            <button onClick={() => {
              reset(); setMode('login');
            }}
              className="w-full text-gray-500 text-sm py-1 flex items-center justify-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Назад ко входу
            </button>
          </>
        )}

        {/* ===== ВВОД КОДА (регистрация) ===== */}
        {mode === 'code' && (
          <>
            <p className="text-sm text-gray-600 mb-3 text-center">
              Код отправлен на <b>{email}</b>. Введите его ниже.
            </p>
            <div className="relative mb-4">
              <KeyRound className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
              <input value={code} onChange={(e) => setCode(e.target.value)}
                placeholder="6-значный код" maxLength={6}
                className={inputCls + ' tracking-widest text-center'} />
            </div>
            <button onClick={doRegisterConfirm} disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-medium py-2.5 rounded-lg mb-2">
              {loading ? 'Проверка...' : 'Подтвердить'}
            </button>
            <button onClick={doRegisterStart} disabled={loading}
              className="w-full text-indigo-600 text-sm py-1">
              Отправить код повторно
            </button>
            <button onClick={() => { reset(); setMode('register'); }}
              className="w-full text-gray-500 text-sm py-1 flex items-center justify-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Назад
            </button>
          </>
        )}

        {/* ===== ВОССТАНОВЛЕНИЕ: ввод почты ===== */}
        {mode === 'reset-email' && (
          <>
            <p className="text-sm text-gray-600 mb-3 text-center">
              Введите почту — пришлём код для смены пароля.
            </p>
            <div className="relative mb-4">
              <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
              <input value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Электронная почта" className={inputCls} />
            </div>
            <button onClick={doResetStart} disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-medium py-2.5 rounded-lg mb-2">
              {loading ? 'Отправка...' : 'Получить код'}
            </button>
            <button onClick={doForgotLogin} disabled={loading}
              className="w-full text-indigo-600 text-sm py-1">
              Забыли логин? Напомнить на почту
            </button>
            <button onClick={() => { reset(); setMode('login'); }}
              className="w-full text-gray-500 text-sm py-1 flex items-center justify-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Назад ко входу
            </button>
          </>
        )}

        {/* ===== ВОССТАНОВЛЕНИЕ: код + новый пароль ===== */}
        {mode === 'reset-code' && (
          <>
            <p className="text-sm text-gray-600 mb-3 text-center">
              Код отправлен на <b>{email}</b>. Введите код и новый пароль.
            </p>
            <div className="relative mb-3">
              <KeyRound className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
              <input value={code} onChange={(e) => setCode(e.target.value)}
                placeholder="Код из письма" maxLength={6}
                className={inputCls + ' tracking-widest text-center'} />
            </div>
            <div className="mb-4">
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Новый пароль (минимум 6 символов)"
                autoComplete="new-password"
              />
            </div>
            <button onClick={doResetConfirm} disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-medium py-2.5 rounded-lg mb-2">
              {loading ? 'Сохранение...' : 'Сменить пароль и войти'}
            </button>
            <button onClick={() => { reset(); setMode('login'); }}
              className="w-full text-gray-500 text-sm py-1 flex items-center justify-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Назад ко входу
            </button>
          </>
        )}
      </div>
    </div>
  );
}


/* ============ ОКНО "ПОДЕЛИТЬСЯ" ============ */

function ShareModal({ test, onClose }) {
  const [copied, setCopied] = useState(false);

  // Ссылка на прохождение теста по коду
  const shareUrl = `${window.location.origin}/?code=${test.shareCode}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // запасной вариант, если clipboard недоступен
      window.prompt('Скопируйте ссылку вручную:', shareUrl);
    }
  };

  // Системное "Поделиться" (на телефоне откроет WhatsApp/Telegram и т.д.)
  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: test.title,
          text: `Пройдите тест: ${test.title}`,
          url: shareUrl,
        });
      } catch {
        // пользователь закрыл окно — ничего не делаем
      }
    } else {
      copyLink();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-800 dark:text-gray-100">Поделиться тестом</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-1">{test.title}</p>
        <p className="text-xs text-gray-400 mb-3">
          Код теста: <span className="font-mono font-bold">{test.shareCode}</span>
        </p>

        <div className="flex justify-center my-3">
          <QRCodeSVG value={shareUrl} size={160} />
        </div>

        {/* Поле со ссылкой */}
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-3">
          <input
            readOnly
            value={shareUrl}
            className="flex-1 bg-transparent text-sm text-gray-700 outline-none truncate"
          />
          <button
            onClick={copyLink} className="flex-shrink-0 text-indigo-600 hover:text-indigo-800"
            title="Скопировать"
          >
            {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>

        {/* Кнопки действий */}
        <button
          onClick={nativeShare}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg mb-2"
        >
          <Share2 className="w-4 h-4" /> Отправить ссылку
        </button>
        <button
          onClick={copyLink}
          className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-lg"
        >
          <Copy className="w-4 h-4" /> {copied ? 'Скопировано!' : 'Скопировать ссылку'}
        </button>
      </div>
    </div>
  );
}


/* ============ ПОЛЕ ПАРОЛЯ С ГЛАЗИКОМ ============ */

function PasswordInput({ value, onChange, placeholder = 'Пароль', autoComplete = 'current-password' }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full border border-gray-300 rounded-lg pl-10 pr-10 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
        title={show ? 'Скрыть пароль' : 'Показать пароль'}
      >
        {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  );
}
