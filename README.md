# Collaborative Kanban Board with Real-Time Sync

**Assignment Submission — Antbox**

---

## 🔗 Project Links

| Resource | Link |
| --- | --- |
| 🌐 Deployed Web App | [Open App](https://script.google.com/macros/s/AKfycbwVl4srCviTvIxxB2udsdNVSwsUcbcOAG8n5Y-ySlrHcxZOFgOn2FfG5xIxsVM7FPt24Q/exec) |
| 💾 Github Repo | [View Repository](https://github.com/PrateekRaj8125/WebApp-Project) |
| 📄 Code.gs (Backend) | [View on GitHub](https://github.com/PrateekRaj8125/WebApp-Project/blob/main/code/Code.gs) |
| 🖼️ Index.html (Frontend) | [View on GitHub](https://github.com/PrateekRaj8125/WebApp-Project/blob/main/code/Index.html) |
| ⚙️ JavaScript.html (Client Logic) | [View on GitHub](https://github.com/PrateekRaj8125/WebApp-Project/blob/main/code/JavaScript.html) |
| 📊 Google Sheet (Database) | [Open Sheet](https://docs.google.com/spreadsheets/d/1QUjgaIVRZdWGLg0_kbo_U6R4CoAss41BdSIOKC-ggL8/edit?usp=sharing) |

---

## 📌 Overview

This project demonstrates a **Kanban board** similar to the functionality provided by **Trello** but built on top of **Google Apps Script**. It supports multiple users working together, with capabilities such as moving cards between columns, creating new tasks, editing task descriptions, and deleting tasks, all in real time for multiple participants.

The first problem that needs to be solved is how to implement **real-time communication without WebSockets** due to the limitations of Google Apps Script. In this case, the proposed solution uses the timestamp-based polling along with optimistic user interface updates.

---

## 🗂️ Project Structure

    ```text
    code
    ├── Code.gs           → Server-side backend (Google Apps Script)
    ├── Index.html        → HTML/CSS frontend layout and styling
    └── JavaScript.html   → Client-side logic (drag-and-drop, polling, API calls)
    ```

The Google Sheet acts as the database, storing all task data with five columns: `TaskID`, `Title`, `Description`, `Status`, and `LastUpdated`.

---

## 🏗️ System Design

### Architecture

    ```text
    [Browser / User]
        │
        │  google.script.run (async RPC)
        ▼
    [Google Apps Script — Code.gs]
        │
        │  SpreadsheetApp API
        ▼
    [Google Sheets — Sheet1 (Database)]
    ```

The frontend communicates with the backend exclusively through `google.script.run`, which is Google Apps Script's built-in asynchronous RPC bridge. There is no separate server or external API — the Apps Script deployment serves both the HTML and handles all data operations.

### Backend Functions (Code.gs)

| Function | Purpose |
| --- | --- |
| `doGet()` | Serves the web app HTML |
| `getTasks()` | Reads and returns all tasks from the sheet |
| `getTasksIfUpdated(lastTimestamp)` | Polling endpoint — returns tasks only if data has changed |
| `addTask(title, description)` | Appends a new task row |
| `updateTaskStatus(taskId, newStatus)` | Updates a task's status column |
| `editTask(taskId, title, description)` | Updates a task's title and description |
| `deleteTask(taskId)` | Deletes a task row by ID |

Every write function wraps its sheet operations inside a `LockService` block to prevent race conditions.

---

## ⏱️ Real-Time Sync (Without WebSockets)

Since Google Apps Script does not support WebSockets or server-push events, real-time collaboration is simulated using **timestamp-based polling**:

1. When the page loads, the client fetches all tasks and records the most recent `lastUpdated` timestamp across all tasks.
2. Every **4 seconds**, the client calls `getTasksIfUpdated(lastKnownTimestamp)` on the server.
3. The server scans all tasks, finds the latest timestamp, and compares it to the client's value:
   - If the server timestamp is **newer** → returns `{ updated: true, tasks: [...], latestTimestamp: "..." }`
   - If nothing has changed → returns `{ updated: false }` immediately, with **zero board re-renders and minimal data transfer**
4. When `updated: true` is received, the client re-renders the board and shows a toast notification.

This approach ensures that the board stays current across multiple open sessions while keeping API call costs minimal — unchanged states cost almost nothing.

    ```javascript
    // Server-side (Code.gs)
    function getTasksIfUpdated(lastKnownTimestamp) {
    const tasks = getTasks();
    const latestTimestamp = tasks.reduce((max, t) =>
        t.lastUpdated > max ? t.lastUpdated : max, '');

    if (latestTimestamp > lastKnownTimestamp) {
        return { updated: true, tasks, latestTimestamp };
    }
    return { updated: false }; // No read cost, no re-render
    }
    ```

---

## 🔒 Conflict Handling (Concurrency)

All write operations use **Google Apps Script's `LockService`** to prevent two users from corrupting data when editing simultaneously.

    ```javascript
    function updateTaskStatus(taskId, newStatus) {
    const lock = LockService.getScriptLock();
    lock.tryLock(5000); // Wait up to 5 seconds to acquire lock
    try {
        // ... perform sheet write ...
        return { success: true };
    } catch(e) {
        return { success: false, error: e.toString() };
    } finally {
        lock.releaseLock(); // Always release, even on error
    }
    }
    ```

**How conflicts are resolved:**

- If two users move the same card simultaneously, one request acquires the script lock and writes first. The second request waits up to 5 seconds, then writes its update on top.
- Since the polling cycle runs every 4 seconds, both users' boards converge to the final consistent state within one poll cycle after the conflict.
- If a write fails (lock timeout or sheet error), the client receives `{ success: false }` and immediately calls `loadTasks()` to re-sync the board to the true server state, discarding any incorrect optimistic update.

---

## ⚡ Performance Optimization

Several strategies are used to minimize API calls and keep the app responsive:

**Timestamp diffing on polls:** `getTasksIfUpdated` compares timestamps before returning any data. Unchanged boards are detected in a single reduce operation — no full data transfer happens unless something actually changed.

**Optimistic UI updates:** When a user moves a card, adds a task, edits, or deletes, the UI updates **instantly** in memory before the server confirms. If the server reports failure, the board re-syncs. This makes every interaction feel immediate despite the latency of Apps Script RPC calls.

**Single-call board loads:** `getTasks()` reads the entire sheet in one `getDataRange().getValues()` call, rather than reading row by row, avoiding multiple quota-consuming API requests.

**Sortable.js re-init guard:** The `initSortable()` function destroys any existing Sortable instance on a column before creating a new one (`el._sortable.destroy()`), preventing listener accumulation across re-renders.

**No polling during user actions:** The 4-second interval runs independently and does not block or interfere with user-triggered writes. Both paths are fully asynchronous.

---

## 🎨 UI/UX Features

- **Drag-and-drop** task movement between columns using [Sortable.js](https://sortablejs.com/)
- **Three columns:** Backlog, In-Progress, Done — each with a live task count badge
- **Add Task** button per column, pre-selecting the correct status
- **Edit and Delete** actions revealed on card hover
- **Live sync indicator** in the header (● Live / ● Syncing / ● Error)
- **Toast notifications** for updates, errors, and confirmations
- **Modal form** for adding and editing tasks, with keyboard-friendly focus
- **Responsive layout** with horizontal scroll for smaller screens

---

## 🆕 Additional Features (Upgrades Beyond Requirements)

- **Per-column Add Task:** Instead of one global "Add Task" button, each column has its own button that pre-assigns the correct status, reducing friction.
- **Optimistic rendering:** All actions (move, add, edit, delete) reflect immediately in the UI rather than waiting for server confirmation — a major UX improvement over the basic requirement.
- **Smart polling with early exit:** Polling is O(n) on the server but exits immediately with `{ updated: false }` when nothing has changed, instead of sending the full dataset every 4 seconds.
- **Edit task content:** Users can update a task's title and description after creation, not just its status/column.
- **Live status indicator:** A colour-coded sync status in the header gives instant feedback — green when live, orange when a sync call is in flight, red on error.
- **Error recovery:** Any failed write automatically triggers a full re-sync from the sheet, so the board never shows stale or incorrect data for more than one poll cycle.

---

## ⚠️ Challenges Faced

**Simulating real-time without WebSockets:** Google Apps Script has no persistent connection model. The timestamp diffing approach was chosen over naive polling (which would re-render the board every 4 seconds regardless) because it eliminates flicker and unnecessary DOM updates when nothing has changed.

**LockService scope:** Apps Script offers `getScriptLock()` (shared across all users) and `getUserLock()` (per-user). `getScriptLock()` was chosen to prevent any two users — including different users doing the same operation — from writing at the same time, which is the correct scope for a shared database.

**Sortable.js re-initialization:** After each board re-render triggered by polling, Sortable instances need to be re-attached to the new DOM elements. Without destroying the old instance first, multiple `onEnd` handlers fire per drag, causing duplicate API calls. The fix was to store the instance on the element and destroy it before re-creating.

**Optimistic vs. server state:** Optimistic updates improve perceived performance but require careful rollback logic. Every write handler includes a `withFailureHandler` that calls `loadTasks()`, ensuring the local optimistic state is replaced by ground truth if anything goes wrong on the server.

**Google Apps Script execution limits:** Each `google.script.run` call has overhead (typically 1–3 seconds). Batching all read data into a single `getDataRange().getValues()` call rather than per-row reads was essential for keeping the board responsive under load.

---

## 🛠️ Tech Stack

| Layer | Technology |
| --- | --- |
| Runtime | Google Apps Script |
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Drag-and-drop | Sortable.js v1.15.0 |
| Database | Google Sheets (Sheet1) |
| Concurrency | LockService (Script-level lock) |
| Sync Strategy | Timestamp-based polling (4s interval) |

---

## 📋 Google Sheet Schema

| Column | Field | Example |
| --- | --- | --- |
| A | TaskID | `task_1714300000000` |
| B | Title | `Design login page` |
| C | Description | `Include OAuth and email fields` |
| D | Status | `In-Progress` |
| E | LastUpdated | `2025-04-28T10:30:00.000Z` |
