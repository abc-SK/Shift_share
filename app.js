import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const storageKey = "shift-share-week-calendar-v4";
const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];
const defaultMembers = ["佐藤", "田中", "鈴木"];

const today = new Date();
const roomId = getRoomId();
let db = null;
let roomRef = null;
let remoteReady = false;
let isApplyingRemote = false;
let appState = normalizeState(loadLocalState());

const els = {
  weekLabel: document.querySelector("#weekLabel"),
  prevWeek: document.querySelector("#prevWeek"),
  nextWeek: document.querySelector("#nextWeek"),
  roomLabel: document.querySelector("#roomLabel"),
  syncStatus: document.querySelector("#syncStatus"),
  copyRoomUrl: document.querySelector("#copyRoomUrl"),
  selectedLabel: document.querySelector("#selectedLabel"),
  memberChoices: document.querySelector("#memberChoices"),
  memberName: document.querySelector("#memberName"),
  addMember: document.querySelector("#addMember"),
  shiftForm: document.querySelector("#shiftForm"),
  formHint: document.querySelector("#formHint"),
  shiftDate: document.querySelector("#shiftDate"),
  startTime: document.querySelector("#startTime"),
  endTime: document.querySelector("#endTime"),
  copySummary: document.querySelector("#copySummary"),
  calendar: document.querySelector("#calendar"),
  toast: document.querySelector("#toast"),
};

init();

function init() {
  els.roomLabel.textContent = `共有ルーム: ${roomId}`;
  render();
  setupFirebase();
  bindEvents();
}

function getRoomId() {
  const params = new URLSearchParams(window.location.search);
  const existing = params.get("room");
  if (existing) return existing.replace(/[^\w-]/g, "").slice(0, 40) || "main";

  const generated = Math.random().toString(36).slice(2, 10);
  params.set("room", generated);
  const nextUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, "", nextUrl);
  return generated;
}

function hasFirebaseConfig() {
  return Boolean(
    firebaseConfig?.apiKey &&
      firebaseConfig?.projectId &&
      !firebaseConfig.projectId.includes("YOUR_"),
  );
}

function setupFirebase() {
  if (!hasFirebaseConfig()) {
    els.syncStatus.textContent = "Firebase未設定: この端末だけに保存中";
    return;
  }

  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    roomRef = doc(db, "rooms", roomId);
    els.syncStatus.textContent = "共有データに接続中...";

    onSnapshot(
      roomRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          remoteReady = true;
          els.syncStatus.textContent = "共有中";
          saveState();
          return;
        }

        isApplyingRemote = true;
        appState = normalizeState({
          ...snapshot.data(),
          selectedMember: appState.selectedMember,
          weekStart: appState.weekStart,
        });
        remoteReady = true;
        els.syncStatus.textContent = "共有中";
        render();
        isApplyingRemote = false;
      },
      () => {
        els.syncStatus.textContent = "共有に接続できません。ローカル保存中";
      },
    );
  } catch {
    els.syncStatus.textContent = "Firebase設定を確認してください。ローカル保存中";
  }
}

function loadLocalState() {
  try {
    const saved = localStorage.getItem(`${storageKey}:${roomId}`);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function normalizeState(saved) {
  if (!saved) {
    return {
      weekStart: formatDate(startOfWeek(today)),
      selectedMember: "",
      members: defaultMembers,
      entries: [],
    };
  }

  const members = Array.isArray(saved.members) ? saved.members : [];
  const savedWeekStart = saved.weekStart ? parseDate(saved.weekStart) : today;

  return {
    weekStart: formatDate(startOfWeek(savedWeekStart)),
    selectedMember: members.includes(saved.selectedMember) ? saved.selectedMember : "",
    members,
    entries: Array.isArray(saved.entries) ? saved.entries : [],
  };
}

async function saveState() {
  localStorage.setItem(`${storageKey}:${roomId}`, JSON.stringify(appState));

  if (!roomRef || isApplyingRemote) return;
  if (!remoteReady && hasFirebaseConfig()) return;

  try {
    await setDoc(
      roomRef,
      {
        members: appState.members,
        entries: appState.entries,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch {
    els.syncStatus.textContent = "共有保存に失敗しました。Firestore設定を確認してください";
  }
}

function startOfWeek(date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - daysSinceMonday);
  return copy;
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}(${weekdayLabels[date.getDay()]})`;
}

function getWeekDates() {
  const start = parseDate(appState.weekStart);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function isCurrentWeekDate(dateText) {
  return getWeekDates().some((date) => formatDate(date) === dateText);
}

function render() {
  renderWeekLabel();
  renderMemberChoices();
  renderDateOptions();
  renderFormState();
  renderCalendar();
  saveState();
}

function renderWeekLabel() {
  const dates = getWeekDates();
  els.weekLabel.textContent = `${formatDisplayDate(dates[0])} - ${formatDisplayDate(dates[6])}`;
}

function renderMemberChoices() {
  els.selectedLabel.textContent = appState.selectedMember || "未選択";
  els.memberChoices.innerHTML = "";

  if (appState.members.length === 0) {
    els.memberChoices.innerHTML = `<p class="empty">名前を追加してください。</p>`;
    return;
  }

  appState.members.forEach((member) => {
    const button = document.createElement("button");
    button.className = "member-choice";
    button.type = "button";
    button.dataset.selected = String(member === appState.selectedMember);
    button.textContent = member;
    button.addEventListener("click", () => {
      appState.selectedMember = member;
      render();
    });
    els.memberChoices.append(button);
  });
}

function renderDateOptions() {
  const selected = els.shiftDate.value;
  els.shiftDate.innerHTML = "";

  getWeekDates().forEach((date) => {
    const option = document.createElement("option");
    option.value = formatDate(date);
    option.textContent = formatDisplayDate(date);
    els.shiftDate.append(option);
  });

  if (selected && isCurrentWeekDate(selected)) {
    els.shiftDate.value = selected;
  }
}

function renderFormState() {
  const disabled = !appState.selectedMember;
  els.shiftForm.querySelectorAll("select, input, button").forEach((control) => {
    control.disabled = disabled;
  });
  els.formHint.textContent = disabled ? "名前を選択してください" : `${appState.selectedMember}として入力中`;
}

function renderCalendar() {
  els.calendar.innerHTML = "";

  getWeekDates().forEach((date) => {
    const card = document.createElement("article");
    card.className = "day-card";

    const head = document.createElement("div");
    head.className = "day-head";
    head.innerHTML = `<strong>${formatDisplayDate(date)}</strong>`;
    card.append(head);

    const entries = getEntriesForDate(formatDate(date));
    const list = document.createElement("div");
    list.className = "entry-list";

    if (entries.length === 0) {
      list.innerHTML = `<p class="empty">まだ入力なし</p>`;
    } else {
      entries.forEach((entry) => list.append(createEntryRow(entry)));
    }

    card.append(list);
    els.calendar.append(card);
  });
}

function getEntriesForDate(dateText) {
  return appState.entries
    .filter((entry) => entry.date === dateText)
    .sort((a, b) => `${a.start}-${a.end}-${a.member}`.localeCompare(`${b.start}-${b.end}-${b.member}`));
}

function createEntryRow(entry) {
  const row = document.createElement("div");
  row.className = "entry-row";
  const canRemove = entry.member === appState.selectedMember;
  row.dataset.readonly = String(!canRemove);

  const text = document.createElement("span");
  text.textContent = `${entry.start}-${entry.end} ${entry.member}`;
  row.append(text);

  if (!canRemove) return row;

  const remove = document.createElement("button");
  remove.className = "remove-entry";
  remove.type = "button";
  remove.textContent = "x";
  remove.setAttribute("aria-label", `${text.textContent}を削除`);
  remove.addEventListener("click", () => removeEntry(entry.id));

  row.append(remove);
  return row;
}

function addMember() {
  const name = els.memberName.value.trim();
  if (!name) {
    showToast("名前を入力してください");
    return;
  }
  if (!appState.members.includes(name)) {
    appState.members.push(name);
  }

  appState.selectedMember = name;
  els.memberName.value = "";
  render();
  showToast(`${name}を選択しました`);
}

function addShift(event) {
  event.preventDefault();
  if (!appState.selectedMember) {
    showToast("先に自分の名前を選んでください");
    return;
  }

  const date = els.shiftDate.value;
  const start = els.startTime.value;
  const end = els.endTime.value;

  if (!date || !start || !end) {
    showToast("日付と時間帯を入力してください");
    return;
  }
  if (start >= end) {
    showToast("終了時刻は開始時刻より後にしてください");
    return;
  }

  appState.entries.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    member: appState.selectedMember,
    date,
    start,
    end,
  });

  render();
  showToast("カレンダーに追加しました");
}

function removeEntry(id) {
  const entry = appState.entries.find((item) => item.id === id);
  if (!entry || entry.member !== appState.selectedMember) {
    showToast("他の人のシフトは削除できません");
    return;
  }

  appState.entries = appState.entries.filter((item) => item.id !== id);
  render();
}

function moveWeek(amount) {
  const start = parseDate(appState.weekStart);
  start.setDate(start.getDate() + amount * 7);
  appState.weekStart = formatDate(start);
  render();
}

function buildSummaryText() {
  const dates = getWeekDates();
  const lines = [`シフト希望 ${formatDisplayDate(dates[0])} - ${formatDisplayDate(dates[6])}`, ""];

  dates.forEach((date) => {
    const dateText = formatDate(date);
    const entries = getEntriesForDate(dateText);
    lines.push(formatDisplayDate(date));
    if (entries.length === 0) {
      lines.push("  なし");
    } else {
      entries.forEach((entry) => {
        lines.push(`  ${entry.start}-${entry.end} ${entry.member}`);
      });
    }
    lines.push("");
  });

  return lines.join("\n").trim();
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  showToast(message);
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 1800);
}

function bindEvents() {
  els.addMember.addEventListener("click", addMember);
  els.memberName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") addMember();
  });
  els.shiftForm.addEventListener("submit", addShift);
  els.prevWeek.addEventListener("click", () => moveWeek(-1));
  els.nextWeek.addEventListener("click", () => moveWeek(1));
  els.copySummary.addEventListener("click", () => {
    copyText(buildSummaryText(), "共有用まとめをコピーしました");
  });
  els.copyRoomUrl.addEventListener("click", () => {
    copyText(window.location.href, "共有URLをコピーしました");
  });
}
