const SHEET_ID = '1QUjgaIVRZdWGLg0_kbo_U6R4CoAss41BdSIOKC-ggL8';
const SHEET_NAME = 'Sheet1';

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Kanban Board')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
function getTasks() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const tasks = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      tasks.push({
        id: data[i][0],
        title: data[i][1],
        description: data[i][2],
        status: data[i][3],
        lastUpdated: data[i][4]
      });
    }
  }
  return tasks;
}
function addTask(title, description) {
  const lock = LockService.getScriptLock();
  lock.tryLock(5000);
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const id = 'task_' + new Date().getTime();
    const timestamp = new Date().toISOString();
    sheet.appendRow([id, title, description, 'Backlog', timestamp]);
    return { success: true, id: id };
  } catch(e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function updateTaskStatus(taskId, newStatus) {
  const lock = LockService.getScriptLock();
  lock.tryLock(5000);
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === taskId) {
        sheet.getRange(i + 1, 4).setValue(newStatus);           // Status col
        sheet.getRange(i + 1, 5).setValue(new Date().toISOString()); // Timestamp
        return { success: true };
      }
    }
    return { success: false, error: 'Task not found' };
  } catch(e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function deleteTask(taskId) {
  const lock = LockService.getScriptLock();
  lock.tryLock(5000);
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === taskId) {
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { success: false, error: 'Task not found' };
  } catch(e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function editTask(taskId, newTitle, newDescription) {
  const lock = LockService.getScriptLock();
  lock.tryLock(5000);
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === taskId) {
        sheet.getRange(i + 1, 2).setValue(newTitle);
        sheet.getRange(i + 1, 3).setValue(newDescription);
        sheet.getRange(i + 1, 5).setValue(new Date().toISOString());
        return { success: true };
      }
    }
    return { success: false, error: 'Task not found' };
  } catch(e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function getTasksIfUpdated(lastKnownTimestamp) {
  const tasks = getTasks();
  if (tasks.length === 0) return { updated: true, tasks: tasks };
  const latestTimestamp = tasks.reduce((max, t) =>
    t.lastUpdated > max ? t.lastUpdated : max, '');
  if (latestTimestamp > lastKnownTimestamp) {
    return { updated: true, tasks: tasks, latestTimestamp: latestTimestamp };
  }
  return { updated: false };
}