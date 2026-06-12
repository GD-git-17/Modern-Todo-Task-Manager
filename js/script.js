
const TASKS_STORAGE_KEY = 'mdt.tasks.v1';

// Migration defaults (Build 2)
const DEFAULT_PRIORITY = 'medium'; // medium/low/high
const PRIORITIES = ['high', 'medium', 'low'];
const CATEGORIES = ['study', 'work', 'personal', 'fitness'];

// =====================
// Utilities
// =====================
function normalizeDateInputToISO(dateStr) {
  // <input type="date"> returns YYYY-MM-DD or ''
  const s = String(dateStr || '').trim();
  if (!s) return null;
  // Basic validity check; keep as YYYY-MM-DD to avoid timezone drift
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function compareDueDates(aISO, bISO) {
  // both either YYYY-MM-DD or null; null goes last
  if (!aISO && !bISO) return 0;
  if (!aISO) return 1;
  if (!bISO) return -1;
  if (aISO === bISO) return 0;
  return aISO < bISO ? -1 : 1;
}

function priorityRank(p) {
  // higher priority rank first: high > medium > low
  if (p === 'high') return 3;
  if (p === 'medium') return 2;
  if (p === 'low') return 1;
  return 0;
}

// =====================
// Init
// =====================
document.addEventListener('DOMContentLoaded', () => {
  // =====================
  // DOM References
  // =====================
  const taskForm = document.getElementById('taskForm');
  const taskInput = document.getElementById('taskInput');
  const taskSearch = document.getElementById('taskSearch');
  const taskListContainer = document.getElementById('taskListContainer');
  const totalTasksEl = document.getElementById('totalTasks');
  const completedTasksEl = document.getElementById('completedTasks');
  const pendingTasksEl = document.getElementById('pendingTasks');
  const formFeedback = document.getElementById('formFeedback');
  const filterButtons = document.querySelectorAll('[data-filter]');

  // Delete modal elements
  const deleteModalEl = document.getElementById('deleteTaskModal');
  const confirmDeleteTaskButton = document.getElementById('confirmDeleteTaskButton');
  const cancelDeleteTaskButton = document.getElementById('cancelDeleteTaskButton');

  const themeToggleBtn = document.getElementById('themeToggle');

  // Cached productivity progressbar elements
  const productivityPercentEl = document.getElementById('productivityPercent');
  const productivityProgressLabelEl = document.getElementById('productivityProgressLabel');
  const productivityBarEl = document.getElementById('productivityProgressBar');

  // =====================
  // State
  // =====================
  let tasks = [];
  let currentFilter = 'all';
  let searchQuery = '';
  let feedbackHideTimer = null;

  // persisted filter/search keys
  const FILTER_STORAGE_KEY = 'mdt.ui.filter.v1';
  const SEARCH_STORAGE_KEY = 'mdt.ui.search.v1';

  let taskIdToDelete = null;
  let lastFocusEl = null;

  // =====================
  // Storage Functions
  // =====================
  function saveTasks() {
    try {
      localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
    } catch (err) {
      console.error('Failed to save tasks', err);
    }
  }

  function loadTasks() {
    try {
      const raw = localStorage.getItem(TASKS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      // Migration: old tasks won't have priority/category/dueDate
      return parsed
        .filter(task => task && typeof task.id === 'string' && typeof task.title === 'string')
        .map(task => {
          const priority = PRIORITIES.includes(task.priority) ? task.priority : DEFAULT_PRIORITY;
          const category = CATEGORIES.includes(task.category) ? task.category : 'work';
          const dueDate = normalizeDateInputToISO(task.dueDate) || null;

          return {
            id: task.id,
            title: String(task.title).trim(),
            completed: Boolean(task.completed),
            createdAt: typeof task.createdAt === 'number' ? task.createdAt : Date.now(),
            priority,
            category,
            dueDate,
          };
        });
    } catch (err) {
      console.warn('Failed to load tasks, resetting.', err);
      return [];
    }
  }

  // =====================
  // UI/Feedback Functions (Accessibility)
  // =====================
  function showFeedback(message = '', type = 'error') {
    if (!formFeedback) return;
    formFeedback.textContent = message;
    formFeedback.classList.remove('visually-hidden', 'text-danger', 'text-success');
    formFeedback.classList.add(type === 'success' ? 'text-success' : 'text-danger');
    // hide after 3s
    clearTimeout(feedbackHideTimer);
    feedbackHideTimer = setTimeout(() => {
      formFeedback.classList.add('visually-hidden');
    }, 3000);
  }

  // =====================
  // Business/CRUD Functions
  // =====================
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  function findTaskIndex(id) {
    return tasks.findIndex(task => task.id === id);
  }

  function addTask({ title, priority, category, dueDate }) {
    const trimmed = String(title || '').trim();
    if (!trimmed) {
      showFeedback('Please enter a task description.', 'error');
      return false;
    }

    const normalizedPriority = PRIORITIES.includes(priority) ? priority : DEFAULT_PRIORITY;
    const normalizedCategory = CATEGORIES.includes(category) ? category : 'work';
    const normalizedDueDate = normalizeDateInputToISO(dueDate) || null;

    // prevent duplicates by title (case-insensitive)
    const exists = tasks.some(t => t.title.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      showFeedback('A task with this title already exists.', 'error');
      return false;
    }

    const task = {
      id: generateId(),
      title: trimmed,
      completed: false,
      createdAt: Date.now(),
      priority: normalizedPriority,
      category: normalizedCategory,
      dueDate: normalizedDueDate,
    };

    tasks.unshift(task); // newest first
    saveTasks();
    renderTasks();
    showFeedback('Task added', 'success');
    return true;
  }

  function deleteTask(id) {
    const index = findTaskIndex(id);
    if (index === -1) return;
    tasks.splice(index, 1);
    saveTasks();
    renderTasks();
  }

  function editTask(id, { title, priority, category, dueDate }) {
    const trimmed = String(title || '').trim();
    if (!trimmed) {
      showFeedback('Task title cannot be empty.', 'error');
      return false;
    }

    const index = findTaskIndex(id);
    if (index === -1) return false;

    const normalizedPriority = PRIORITIES.includes(priority) ? priority : DEFAULT_PRIORITY;
    const normalizedCategory = CATEGORIES.includes(category) ? category : 'work';
    const normalizedDueDate = normalizeDateInputToISO(dueDate) || null;

    const duplicate = tasks.some(
      task => task.id !== id && task.title.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      showFeedback('Another task already uses this title.', 'error');
      return false;
    }

    tasks[index].title = trimmed;
    tasks[index].priority = normalizedPriority;
    tasks[index].category = normalizedCategory;
    tasks[index].dueDate = normalizedDueDate;

    saveTasks();
    renderTasks();
    showFeedback('Task updated', 'success');
    return true;
  }

  function toggleTask(id) {
    const index = findTaskIndex(id);
    if (index === -1) return;
    tasks[index].completed = !tasks[index].completed;
    saveTasks();
    renderTasks();
  }

  // =====================
  // Rendering Helpers
  // =====================
  function matchesCurrentView(task) {
    const matchesFilter =
      currentFilter === 'all' ||
      (currentFilter === 'completed' && task.completed) ||
      (currentFilter === 'pending' && !task.completed);

    const matchesSearch = searchQuery
      ? task.title.toLowerCase().includes(searchQuery.toLowerCase())
      : true;

    return matchesFilter && matchesSearch;
  }

  function sortTasksView(list, tToday) {
    // Sort by: pending first, then priority high->low, then due date (earlier first), then createdAt desc
    const copy = [...list];
    copy.sort((a, b) => {
      const aPending = a.completed ? 1 : 0;
      const bPending = b.completed ? 1 : 0;
      if (aPending !== bPending) return aPending - bPending;

      const pr = priorityRank(b.priority) - priorityRank(a.priority);
      if (pr !== 0) return pr;

      const dueCmp = compareDueDates(a.dueDate, b.dueDate);
      if (dueCmp !== 0) return dueCmp;

      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    return copy;
  }

  function getPriorityLabel(priority) {
    return priority === 'high' ? 'High' : priority === 'low' ? 'Low' : 'Medium';
  }

  function getCategoryLabel(category) {
    return category === 'study'
      ? 'Study'
      : category === 'work'
        ? 'Work'
        : category === 'personal'
          ? 'Personal'
          : 'Fitness';
  }

  function renderEmptyState(filteredLength) {
    // Empty state variants
    const hasAnyTasks = tasks.length > 0;
    const isSearchEmpty = Boolean(searchQuery);

    let title = '';
    let description = '';
    let icon = '✨';

    if (!hasAnyTasks) {
      title = 'No tasks yet';
      description = 'Add your first task above to start building momentum.';
      icon = '🗒️';
    } else if (isSearchEmpty) {
      title = 'No matching results';
      description = 'Try a different search term or clear the search box.';
      icon = '🔎';
    } else if (currentFilter === 'completed') {
      title = 'No completed tasks';
      description = 'Once you check items off, they’ll show up here.';
      icon = '✅';
    } else if (currentFilter === 'pending') {
      title = 'No pending tasks';
      description = 'You’re all caught up—great work!';
      icon = '🌿';
    } else {
      title = 'No tasks to display';
      description = 'Try switching filters or adding a new task.';
      icon = '📭';
    }

    const empty = document.createElement('div');
    empty.className = 'task-empty-state text-center py-5 p-4';
    empty.setAttribute('role', 'status');
    empty.innerHTML = `
        <div class="task-empty-icon" aria-hidden="true">${icon}</div>
        <div class="task-empty-title mb-2">${title}</div>
        <p class="task-empty-desc mb-0">${description}</p>
      `;

    taskListContainer.appendChild(empty);
    updateStats();
  }

  function renderTaskItem(task, tToday, frag) {
    const item = document.createElement('div');
    item.className = 'task-item';
    item.setAttribute('data-task-id', task.id);
    if (task.completed) item.classList.add('task-completed');

    // left: checkbox + title + badges
    const left = document.createElement('div');
    left.className = 'task-left';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'form-check-input task-checkbox';
    checkbox.checked = !!task.completed;
    checkbox.setAttribute(
      'aria-label',
      task.completed ? 'Mark task as pending' : 'Mark task as completed'
    );
    checkbox.addEventListener('change', () => toggleTask(task.id));

    const titleWrap = document.createElement('div');
    titleWrap.className = 'task-title-wrap';

    const titleRow = document.createElement('div');
    titleRow.className = 'task-title-row d-flex flex-wrap align-items-center gap-2';

    const title = document.createElement('span');
    title.className = 'task-title';
    title.textContent = task.title;

    const priorityBadge = document.createElement('span');
    priorityBadge.className =
      `badge rounded-pill task-badge task-priority task-priority-${task.priority || DEFAULT_PRIORITY}`;
    const priorityLabel = getPriorityLabel(task.priority);
    priorityBadge.textContent = priorityLabel;
    priorityBadge.setAttribute('aria-label', `Priority: ${priorityLabel}`);

    const categoryBadge = document.createElement('span');
    const categoryLabel = getCategoryLabel(task.category);
    categoryBadge.className = 'badge rounded-pill task-badge task-category';
    categoryBadge.textContent = categoryLabel;
    categoryBadge.setAttribute('aria-label', `Category: ${categoryLabel}`);

    titleRow.appendChild(title);
    titleRow.appendChild(priorityBadge);
    titleRow.appendChild(categoryBadge);

    // Due date indicator
    const due = document.createElement('div');
    due.className = 'task-due';
    const hasDue = Boolean(task.dueDate);
    if (!hasDue) {
      due.innerHTML = `<span class="task-due-empty text-secondary small">No due date</span>`;
    } else {
      const dueISO = task.dueDate;
      const dueIsToday = dueISO === tToday;
      const dueIsOverdue = !task.completed && dueISO < tToday;

      const dueText = dueIsToday
        ? `Due today: ${dueISO}`
        : dueIsOverdue
          ? `Overdue: ${dueISO}`
          : `Due: ${dueISO}`;

      if (dueIsOverdue) {
        due.classList.add('task-due-overdue');
        item.classList.add('task-due-overdue-card');
      }
      if (dueIsToday) {
        due.classList.add('task-due-today');
        item.classList.add('task-due-today-card');
      }

      due.innerHTML = `<span class="small">${dueText}</span>`;
    }

    titleWrap.appendChild(titleRow);
    titleWrap.appendChild(due);

    left.appendChild(checkbox);
    left.appendChild(titleWrap);

    // actions
    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-sm btn-outline-secondary';
    editBtn.type = 'button';
    editBtn.title = 'Edit task';
    editBtn.innerHTML = 'Edit';
    editBtn.addEventListener('click', () => enterEditMode(item, task));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-sm btn-outline-danger';
    delBtn.type = 'button';
    delBtn.title = 'Delete task';
    delBtn.innerHTML = 'Delete';
    delBtn.addEventListener('click', () => {
      lastFocusEl = document.activeElement;
      taskIdToDelete = task.id;
      const instance = bootstrap.Modal.getOrCreateInstance(deleteModalEl);
      instance.show();
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    item.appendChild(left);
    item.appendChild(actions);

    frag.appendChild(item);
  }

  // =====================
  // Accessibility Functions (Focus management)
  // =====================
  function focusRestoreAfterEditCancel() {
    // Preserve current UX: cancel re-renders and focuses remain unchanged.
    // This helper exists for future extension without changing behavior now.
  }

  // enter edit mode on a task item
  function enterEditMode(itemEl, task) {
    // locate title wrap and actions
    const actionsEl = itemEl.querySelector('.task-actions');
    const titleWrapEl = itemEl.querySelector('.task-title-wrap');
    if (!actionsEl || !titleWrapEl) return;

    // Save original content by re-rendering on cancel; easiest + safe
    actionsEl.innerHTML = '';

    const inputTitle = document.createElement('input');
    inputTitle.type = 'text';
    inputTitle.className = 'form-control task-edit-input';
    inputTitle.value = task.title;
    inputTitle.setAttribute('aria-label', 'Edit task title');

    const prioritySelect = document.createElement('select');
    prioritySelect.className = 'form-select task-edit-select';
    prioritySelect.setAttribute('aria-label', 'Edit priority');

    PRIORITIES.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p === 'high' ? '🔴 High' : p === 'low' ? '🟢 Low' : '🟡 Medium';
      if (p === (task.priority || DEFAULT_PRIORITY)) opt.selected = true;
      prioritySelect.appendChild(opt);
    });

    const categorySelect = document.createElement('select');
    categorySelect.className = 'form-select task-edit-select';
    categorySelect.setAttribute('aria-label', 'Edit category');

    const categoryLabelMap = {
      study: 'Study',
      work: 'Work',
      personal: 'Personal',
      fitness: 'Fitness',
    };
    CATEGORIES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = categoryLabelMap[c] || c;
      if (c === (task.category || 'work')) opt.selected = true;
      categorySelect.appendChild(opt);
    });

    const dueInput = document.createElement('input');
    dueInput.type = 'date';
    dueInput.className = 'form-control task-edit-select';
    dueInput.setAttribute('aria-label', 'Edit due date');
    if (task.dueDate) dueInput.value = task.dueDate;

    // Replace titleWrap with editing UI
    const editWrap = document.createElement('div');
    editWrap.className = 'task-edit-wrap d-flex flex-column gap-2';

    editWrap.appendChild(inputTitle);
    editWrap.appendChild(prioritySelect);
    editWrap.appendChild(categorySelect);
    editWrap.appendChild(dueInput);

    titleWrapEl.innerHTML = '';
    titleWrapEl.appendChild(editWrap);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-sm btn-primary';
    saveBtn.type = 'button';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
      const ok = editTask(task.id, {
        title: inputTitle.value,
        priority: prioritySelect.value,
        category: categorySelect.value,
        dueDate: dueInput.value,
      });
      if (ok) taskInput.focus();
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-sm btn-outline-secondary';
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      renderTasks();
      focusRestoreAfterEditCancel();
    });

    actionsEl.appendChild(saveBtn);
    actionsEl.appendChild(cancelBtn);

    // keyboard: Enter to save, Escape to cancel
    inputTitle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveBtn.click();
      else if (e.key === 'Escape') cancelBtn.click();
    });

    inputTitle.focus();
    inputTitle.select();
  }

  // =====================
  // Rendering (Main)
  // =====================
  function renderTasks() {
    // clear
    taskListContainer.innerHTML = '';

    const tToday = todayISO();

    const filtered = tasks.filter(matchesCurrentView);
    const sorted = sortTasksView(filtered, tToday);

    if (sorted.length === 0) {
      renderEmptyState(sorted.length);
      return;
    }

    const frag = document.createDocumentFragment();
    sorted.forEach(task => renderTaskItem(task, tToday, frag));

    taskListContainer.appendChild(frag);
    updateStats();
  }

  // =====================
  // Stats
  // =====================
  function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;

    if (totalTasksEl) totalTasksEl.textContent = String(total);
    if (completedTasksEl) completedTasksEl.textContent = String(completed);
    if (pendingTasksEl) pendingTasksEl.textContent = String(pending);

    // Productivity progress bar
    if (productivityPercentEl && productivityProgressLabelEl && productivityBarEl) {
      const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

      productivityPercentEl.textContent = String(percent);
      productivityBarEl.setAttribute('aria-valuenow', String(percent));
      productivityProgressLabelEl.textContent = `${completed}/${total} complete`;

      const barInner = productivityBarEl.querySelector('.progress-bar');
      if (barInner) {
        // Animated width update (CSS handles transition)
        barInner.style.width = `${percent}%`;
      }
    }
  }

  // =====================
  // Delete Modal (Focus management)
  // =====================
  if (deleteModalEl && confirmDeleteTaskButton && cancelDeleteTaskButton) {
    const modalInstance = bootstrap.Modal.getOrCreateInstance(deleteModalEl, {
      backdrop: true,
      keyboard: true,
    });

    deleteModalEl.addEventListener('shown.bs.modal', () => {
      // Bootstrap handles focus trap; we ensure initial focus is on the primary action.
      confirmDeleteTaskButton.focus();
    });

    deleteModalEl.addEventListener('hidden.bs.modal', () => {
      // Restore focus to the element that opened the modal
      if (lastFocusEl && typeof lastFocusEl.focus === 'function') {
        lastFocusEl.focus();
      }
      lastFocusEl = null;
      taskIdToDelete = null;
    });

    confirmDeleteTaskButton.addEventListener('click', () => {
      if (!taskIdToDelete) {
        modalInstance.hide();
        return;
      }

      // Fade-out the matching DOM node first
      const taskNode = taskListContainer.querySelector(
        `[data-task-id="${CSS.escape(taskIdToDelete)}"]`
      );
      if (taskNode) {
        taskNode.classList.add('task-delete-exit');
        const timeoutId = window.setTimeout(() => {
          deleteTask(taskIdToDelete);
        }, 210);

        taskNode.addEventListener(
          'transitionend',
          () => {
            window.clearTimeout(timeoutId);
            deleteTask(taskIdToDelete);
          },
          { once: true }
        );
      } else {
        deleteTask(taskIdToDelete);
      }

      modalInstance.hide();
    });

    // Cancel: bootstrap dismiss triggers hidden event => focus restoration.
  }

  // =====================
  // Dark mode
  // =====================
  const THEME_STORAGE_KEY = 'mdt.ui.theme.v1';

  function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    if (themeToggleBtn) {
      themeToggleBtn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      themeToggleBtn.textContent = isDark ? '☀️' : '🌙';
      themeToggleBtn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    }
  }

  if (themeToggleBtn) {
    let savedTheme = null;
    try {
      savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {}

    const initial = savedTheme === 'dark' ? 'dark' : 'light';
    applyTheme(initial);

    themeToggleBtn.addEventListener('click', () => {
      const currentTheme =
        document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const next = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {}
    });
  }

  // =====================
  // Event Handlers / Initialization
  // =====================
  tasks = loadTasks();

  // Restore persisted filter/search
  try {
    const savedFilter = localStorage.getItem(FILTER_STORAGE_KEY);
    const savedSearch = localStorage.getItem(SEARCH_STORAGE_KEY);

    if (savedFilter && ['all', 'completed', 'pending'].includes(savedFilter)) {
      currentFilter = savedFilter;
    }
    if (typeof savedSearch === 'string') {
      searchQuery = savedSearch;
    }

    // sync UI
    filterButtons.forEach(b => {
      const f = b.getAttribute('data-filter');
      const isActive = f === currentFilter;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    if (taskSearch) {
      taskSearch.value = searchQuery;
    }
  } catch (err) {
    // ignore
  }

  // form submit (Add task)
  if (taskForm) {
    taskForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const taskPriority = document.getElementById('taskPriority');
      const taskCategory = document.getElementById('taskCategory');
      const taskDueDate = document.getElementById('taskDueDate');

      const value = taskInput.value;
      const ok = addTask({
        title: value,
        priority: taskPriority ? taskPriority.value : DEFAULT_PRIORITY,
        category: taskCategory ? taskCategory.value : 'work',
        dueDate: taskDueDate ? taskDueDate.value : null,
      });

      if (ok) {
        taskInput.value = '';
        if (taskDueDate) taskDueDate.value = '';
        if (taskPriority) taskPriority.value = DEFAULT_PRIORITY;
        if (taskCategory) taskCategory.value = 'work';
        taskInput.focus();
      }
    });
  }

  // Search
  if (taskSearch) {
    taskSearch.addEventListener('input', (e) => {
      searchQuery = String(e.target.value || '').trim();
      try {
        localStorage.setItem(SEARCH_STORAGE_KEY, searchQuery);
      } catch {}
      renderTasks();
    });
  }

  // Filters
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const f = btn.getAttribute('data-filter');
      currentFilter = f || 'all';
      try {
        localStorage.setItem(FILTER_STORAGE_KEY, currentFilter);
      } catch {}

      filterButtons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });

      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      renderTasks();
    });
  });

  // initial render
  renderTasks();
});

