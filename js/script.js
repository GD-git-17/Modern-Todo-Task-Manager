/**
 * Modern To-Do Manager — Phase 2
 * Implements full CRUD, localStorage persistence, accessibility improvements,
 * responsive rendering and UI polish.
 */

const TASKS_STORAGE_KEY = 'mdt.tasks.v1';

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const taskForm = document.getElementById('taskForm');
  const taskInput = document.getElementById('taskInput');
  const taskSearch = document.getElementById('taskSearch');
  const taskListContainer = document.getElementById('taskListContainer');
  const totalTasksEl = document.getElementById('totalTasks');
  const completedTasksEl = document.getElementById('completedTasks');
  const pendingTasksEl = document.getElementById('pendingTasks');
  const formFeedback = document.getElementById('formFeedback');
  const filterButtons = document.querySelectorAll('[data-filter]');

  // State
  let tasks = [];
  let currentFilter = 'all';
  let searchQuery = '';
  let feedbackHideTimer = null;

  // --- Storage helpers ---
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
      return parsed
        .filter(task => task && typeof task.id === 'string' && typeof task.title === 'string')
        .map(task => ({
          id: task.id,
          title: String(task.title).trim(),
          completed: Boolean(task.completed),
          createdAt: typeof task.createdAt === 'number' ? task.createdAt : Date.now(),
        }));
    } catch (err) {
      console.warn('Failed to load tasks, resetting.', err);
      return [];
    }
  }

  // --- Utilities ---
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

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

  // --- CRUD operations ---
  function addTask(title) {
    const trimmed = String(title || '').trim();
    if (!trimmed) {
      showFeedback('Please enter a task description.', 'error');
      return false;
    }
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
    };

    tasks.unshift(task); // newest first
    saveTasks();
    renderTasks();
    showFeedback('Task added', 'success');
    return true;
  }

  function findTaskIndex(id) {
    return tasks.findIndex(task => task.id === id);
  }

  function deleteTask(id) {
    const index = findTaskIndex(id);
    if (index === -1) return;
    tasks.splice(index, 1);
    saveTasks();
    renderTasks();
  }

  function editTask(id, newTitle) {
    const trimmed = String(newTitle || '').trim();
    if (!trimmed) {
      showFeedback('Task title cannot be empty.', 'error');
      return false;
    }
    const index = findTaskIndex(id);
    if (index === -1) return false;
    const duplicate = tasks.some(task => task.id !== id && task.title.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      showFeedback('Another task already uses this title.', 'error');
      return false;
    }
    tasks[index].title = trimmed;
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

  // --- Rendering ---
  function renderTasks() {
    // clear
    taskListContainer.innerHTML = '';

    const filtered = tasks.filter(t => {
      const matchesFilter =
        currentFilter === 'all' ||
        (currentFilter === 'completed' && t.completed) ||
        (currentFilter === 'pending' && !t.completed);
      const matchesSearch = searchQuery
        ? t.title.toLowerCase().includes(searchQuery.toLowerCase())
        : true;
      return matchesFilter && matchesSearch;
    });

    if (filtered.length === 0) {
      const message = tasks.length === 0
        ? 'No tasks available yet.'
        : searchQuery
          ? 'No tasks match your search.'
          : 'No tasks match the selected filter.';

      const empty = document.createElement('div');
      empty.className = 'text-center py-5';
      empty.innerHTML = `
        <span class="d-block mb-2 text-muted">${message}</span>
        <p class="mb-0 small text-secondary">Try clearing the search or adding a new task.</p>
      `;
      taskListContainer.appendChild(empty);
      updateStats();
      return;
    }

    const frag = document.createDocumentFragment();
    filtered.forEach(task => {
      const item = document.createElement('div');
      item.className = 'task-item';
      if (task.completed) item.classList.add('task-completed');

      // left: checkbox + title
      const left = document.createElement('div');
      left.className = 'task-left';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'form-check-input task-checkbox';
      checkbox.checked = !!task.completed;
      checkbox.setAttribute('aria-label', task.completed ? 'Mark task as pending' : 'Mark task as completed');
      checkbox.addEventListener('change', () => toggleTask(task.id));

      const title = document.createElement('span');
      title.className = 'task-title';
      title.textContent = task.title;

      left.appendChild(checkbox);
      left.appendChild(title);

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
        const ok = confirm('Delete this task?');
        if (ok) deleteTask(task.id);
      });

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      item.appendChild(left);
      item.appendChild(actions);

      frag.appendChild(item);
    });

    taskListContainer.appendChild(frag);
    updateStats();
  }

  // enter edit mode on a task item
  function enterEditMode(itemEl, task) {
    // locate title and actions
    const titleEl = itemEl.querySelector('.task-title');
    const actionsEl = itemEl.querySelector('.task-actions');
    if (!titleEl || !actionsEl) return;

    // create input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-control task-edit-input';
    input.value = task.title;
    input.setAttribute('aria-label', 'Edit task title');

    // replace title with input
    titleEl.replaceWith(input);

    // replace actions with save/cancel
    actionsEl.innerHTML = '';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-sm btn-primary';
    saveBtn.type = 'button';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
      const ok = editTask(task.id, input.value);
      if (ok) {
        // focus back to input for keyboard users
        taskInput.focus();
      }
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-sm btn-outline-secondary';
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      renderTasks();
    });

    actionsEl.appendChild(saveBtn);
    actionsEl.appendChild(cancelBtn);

    // keyboard: Enter to save, Escape to cancel
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        saveBtn.click();
      } else if (e.key === 'Escape') {
        cancelBtn.click();
      }
    });

    input.focus();
    input.select();
  }

  // --- Stats ---
  function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;

    if (totalTasksEl) totalTasksEl.textContent = String(total);
    if (completedTasksEl) completedTasksEl.textContent = String(completed);
    if (pendingTasksEl) pendingTasksEl.textContent = String(pending);
  }

  // --- Event bindings ---
  // load state
  tasks = loadTasks();

  // form submit (Add task)
  if (taskForm) {
    taskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const value = taskInput.value;
      const ok = addTask(value);
      if (ok) {
        taskInput.value = '';
        taskInput.focus();
      }
    });
  }

  if (taskSearch) {
    taskSearch.addEventListener('input', (e) => {
      searchQuery = String(e.target.value || '').trim();
      renderTasks();
    });
  }

  // filter buttons
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const f = btn.getAttribute('data-filter');
      currentFilter = f || 'all';
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
