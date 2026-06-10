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

  // Delete modal elements
  const deleteModalEl = document.getElementById('deleteTaskModal');
  const confirmDeleteTaskButton = document.getElementById('confirmDeleteTaskButton');
  const cancelDeleteTaskButton = document.getElementById('cancelDeleteTaskButton');

  // State
  let tasks = [];
  let currentFilter = 'all';
  let searchQuery = '';
  let feedbackHideTimer = null;

  // persisted filter/search keys
  const FILTER_STORAGE_KEY = 'mdt.ui.filter.v1';
  const SEARCH_STORAGE_KEY = 'mdt.ui.search.v1';

  let taskIdToDelete = null;
  let lastFocusEl = null;

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
      return;
    }

    const frag = document.createDocumentFragment();
    filtered.forEach(task => {
      const item = document.createElement('div');
      item.className = 'task-item';
      item.setAttribute('data-task-id', task.id);
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

  // --- Delete modal behavior + focus management ---
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
      const taskNode = taskListContainer.querySelector(`[data-task-id="${CSS.escape(taskIdToDelete)}"]`);
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

  // --- Event bindings ---
  // load state
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
      try {
        localStorage.setItem(SEARCH_STORAGE_KEY, searchQuery);
      } catch {}
      renderTasks();
    });
  }

  // filter buttons
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
