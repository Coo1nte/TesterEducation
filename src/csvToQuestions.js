// ==================== ИМПОРТ ВОПРОСОВ ИЗ CSV ====================

// Простой парсер CSV, понимает кавычки и разделитель ";" внутри кавычек.
// Разделитель определяется автоматически: ',' или ';' (для русского Excel).
export function parseCSV(text) {
  // убираем BOM, если Excel добавил
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  const firstLine = text.split(/\r?\n/)[0] || '';
  const semi = (firstLine.match(/;/g) || []).length;
  const comma = (firstLine.match(/,/g) || []).length;
  const delim = semi > comma ? ';' : ',';

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delim) { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch === '\r') { /* skip */ }
      else field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  // убираем пустые строки
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// Превращает массив строк CSV в массив вопросов в формате приложения.
// Возвращает { questions, errors } — errors это массив строк с описанием проблем.
export function csvToQuestions(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) {
    return { questions: [], errors: ['Файл пуст или содержит только заголовок'] };
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name) => header.indexOf(name);

  const colQ = idx('question');
  const colType = idx('type');
  const colCorrect = idx('correct');
  const colImage = idx('image');
  const colLeft = idx('left');
  const colRight = idx('right');

  if (colQ === -1 || colType === -1) {
    return {
      questions: [],
      errors: ['В первой строке должны быть колонки "question" и "type"'],
    };
  }

  // Для вариантов: все колонки option1..optionN
  const optionCols = header
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => /^option\d+$/.test(h))
    .sort((a, b) => parseInt(a.h.slice(6)) - parseInt(b.h.slice(6)))
    .map(({ i }) => i);

  // Для order: item1..itemN
  const itemCols = header
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => /^item\d+$/.test(h))
    .sort((a, b) => parseInt(a.h.slice(4)) - parseInt(b.h.slice(4)))
    .map(({ i }) => i);

  const questions = [];
  const errors = [];
  const matchGroups = new Map(); // question text -> question object
  let baseId = Date.now();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (i) => (i >= 0 && row[i] != null ? row[i].trim() : '');

    const qText = get(colQ);
    const qType = get(colType).toLowerCase();

    if (!qText) { errors.push(`Строка ${r + 1}: пустой текст вопроса`); continue; }

    const ALLOWED = ['single', 'multiple', 'text', 'match', 'order'];
    if (!ALLOWED.includes(qType)) {
      errors.push(`Строка ${r + 1}: неизвестный тип "${qType}" (допустимо: ${ALLOWED.join(', ')})`);
      continue;
    }

    // ===== MATCH: склеиваем строки с одинаковым question =====
    if (qType === 'match') {
      const left = colLeft >= 0 ? get(colLeft) : '';
      const right = colRight >= 0 ? get(colRight) : '';
      if (!left || !right) {
        errors.push(`Строка ${r + 1}: для match нужны колонки left и right`);
        continue;
      }
      if (!matchGroups.has(qText)) {
        const q = {
          id: baseId++,
          text: qText,
          image: colImage >= 0 ? get(colImage) : '',
          format: 'match',
          options: [],
          pairs: [],
          correctText: '',
          required: false,
        };
        matchGroups.set(qText, q);
        questions.push(q);
      }
      matchGroups.get(qText).pairs.push({
        id: baseId++,
        leftText: left,
        leftImage: '',
        rightText: right,
        rightImage: '',
      });
      continue;
    }

    // ===== ORDER: строка = один вопрос =====
    if (qType === 'order') {
      const items = itemCols.map((i) => get(i)).filter((t) => t !== '');
      if (items.length < 2) {
        errors.push(`Строка ${r + 1}: для order нужно минимум 2 колонки item1, item2...`);
        continue;
      }
      questions.push({
        id: baseId++,
        text: qText,
        image: colImage >= 0 ? get(colImage) : '',
        format: 'order',
        options: [],
        pairs: [],
        correctText: '',
        required: false,
        orderItems: items.map((text, i) => ({ id: baseId + i, text })),
      });
      baseId += items.length;
      continue;
    }

    // ===== TEXT =====
    if (qType === 'text') {
      questions.push({
        id: baseId++,
        text: qText,
        image: colImage >= 0 ? get(colImage) : '',
        format: 'text',
        options: [],
        pairs: [],
        correctText: colCorrect >= 0 ? get(colCorrect) : '',
        required: false,
      });
      continue;
    }

    // ===== SINGLE / MULTIPLE =====
    const options = optionCols.map((i) => get(i)).filter((t) => t !== '');
    if (options.length < 2) {
      errors.push(`Строка ${r + 1}: нужно минимум 2 варианта (option1, option2...)`);
      continue;
    }

    // correct: "1" или "2;4" или "1,3" (номер с 1)
    const correctRaw = colCorrect >= 0 ? get(colCorrect) : '';
    const correctNumbers = correctRaw
      .split(/[;,]/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));

    if (correctNumbers.length === 0) {
      errors.push(`Строка ${r + 1}: не указан correct (номер правильного варианта)`);
      continue;
    }

    const optObjs = options.map((text, i) => ({
      id: baseId + i,
      text,
      correct: correctNumbers.includes(i + 1),
    }));
    baseId += options.length;

    if (qType === 'single' && optObjs.filter((o) => o.correct).length !== 1) {
      errors.push(`Строка ${r + 1}: для single нужен ровно один правильный вариант`);
      continue;
    }
    if (qType === 'multiple' && optObjs.filter((o) => o.correct).length === 0) {
      errors.push(`Строка ${r + 1}: для multiple нужен хотя бы один правильный вариант`);
      continue;
    }

    questions.push({
      id: baseId++,
      text: qText,
      image: colImage >= 0 ? get(colImage) : '',
      format: qType,
      options: optObjs,
      pairs: [],
      correctText: '',
      required: false,
    });
  }

  return { questions, errors };
}