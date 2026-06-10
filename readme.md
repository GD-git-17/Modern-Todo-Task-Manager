# Modern To-Do Manager

A modern, accessible, responsive to-do task manager built for production readiness. It supports task CRUD, search, filters, statistics, and localStorage persistence.

## Features

- **Create / Edit / Toggle Complete / Delete** tasks (CRUD)
- **Search** tasks by title
- **Filters**: All / Completed / Pending
- **Statistics**: Total, Completed, Pending counts
- **Persistent UI state**: filter + search restored after refresh
- **Accessible interactions**
  - Keyboard-friendly controls
  - Delete confirmation uses an accessible Bootstrap modal (focus trap + Escape + focus restoration)
- **Subtle UI polish**
  - Task creation fade-in
  - Task deletion fade-out
  - Micro-interactions on buttons
- **Empty states**
  - No tasks yet
  - No completed tasks
  - No pending tasks
  - No matching search results

## Screenshots

> Add screenshots here (optional). Typical areas to capture:
> - Task list with filters
> - Delete modal
> - Each empty state

## Tech Stack

- **HTML**
- **CSS** (custom styling)
- **JavaScript** (vanilla)
- **Bootstrap 5** (layout + modal)

## Installation

No build step required.

1. Clone / download the project
2. Open `index.html` in a browser

## Usage

1. Add a task using the **Add Task** form.
2. Use **Search** to filter by title.
3. Use **All / Completed / Pending** buttons to switch views.
4. Use **Edit** to change a task title.
5. Use **Delete** to remove a task (confirmation via modal).

## Folder Structure

```text
modern todo task/
  index.html
  css/
    style.css
  js/
    script.js
  assets/
  README.md
```

## Accessibility Features

- **Modal accessibility**
  - Delete confirmation uses Bootstrap modal markup and behavior
  - Keyboard trap during modal open
  - **Escape** closes the modal
  - Focus is restored to the element that opened the modal
- **Semantic HTML & labeling**
  - Buttons and inputs include appropriate labels/aria attributes where needed
  - The task list region uses `role="region"` and `aria-live="polite"`
- **Visible focus states**
  - Strong `:focus-visible` styling for keyboard users
- **Reduced motion support**
  - Animations are disabled when `prefers-reduced-motion: reduce` is enabled

## Future Enhancements

- Due dates, categories, and prioritization
- Drag-and-drop ordering
- Productivity dashboard view

## Author Information

- **BlackboxAI** (project production readiness improvements)

