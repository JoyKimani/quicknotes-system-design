const API_URL = "https://jsonplaceholder.typicode.com/posts";
const LOAD_URL = `${API_URL}?_limit=10`;

const loadButton = document.querySelector("#load-btn");
const statusMessage = document.querySelector("#status");
const notesList = document.querySelector("#notes-list");
const noteForm = document.querySelector("#note-form");
const titleInput = document.querySelector("#title-input");
const bodyInput = document.querySelector("#body-input");
const submitButton = document.querySelector("#submit-btn");

let notes = [];

function setStatus(message, state = "idle") {
  statusMessage.textContent = message;
  statusMessage.dataset.state = state;
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = new Error(`Request failed with status ${response.status}.`);
    error.status = response.status;
    throw error;
  }

  const data = response.status === 204 ? null : await response.json();
  return { data, status: response.status };
}

function renderNotes(noteList) {
  notesList.replaceChildren();

  if (noteList.length === 0) {
    const emptyState = document.createElement("li");
    emptyState.classList.add("empty-state");
    emptyState.textContent = "No notes yet. Load notes from the server or create one to get started.";
    notesList.append(emptyState);
    return;
  }

  for (const note of noteList) {
    const item = document.createElement("li");
    const title = document.createElement("h3");
    const body = document.createElement("p");

    item.classList.add("note-card");
    title.textContent = note.title || "Untitled note";
    body.textContent = note.body || "No additional details.";
    item.append(title, body);
    notesList.append(item);
  }
}

async function loadNotes() {
  loadButton.disabled = true;
  notesList.setAttribute("aria-busy", "true");
  setStatus("Loading notes...", "loading");

  try {
    const result = await request(LOAD_URL);
    if (!Array.isArray(result.data)) {
      throw new Error("The server returned an unexpected response.");
    }

    notes = result.data;
    renderNotes(notes);
    if (notes.length === 0) {
      setStatus("No notes were returned by the server.", "success");
    } else {
      setStatus(`Loaded ${notes.length} notes from the server.`, "success");
    }
  } catch {
    setStatus("We couldn't load your notes. Please check your connection and try again.", "error");
  } finally {
    loadButton.disabled = false;
    notesList.setAttribute("aria-busy", "false");
  }
}

async function createNote(note) {
  submitButton.disabled = true;
  setStatus("Creating note...", "loading");

  try {
    const result = await request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify(note),
    });

    notes.unshift(result.data);
    renderNotes(notes);
    setStatus(`Note created (status ${result.status}, id ${result.data.id}).`, "success");
    noteForm.reset();
  } catch (error) {
    const detail = error.status ? ` (status ${error.status})` : "";
    setStatus(`We couldn't create the note${detail}. Please try again.`, "error");
  } finally {
    submitButton.disabled = false;
  }
}

loadButton.addEventListener("click", loadNotes);
noteForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();

  if (!title) {
    setStatus("A title is required.", "error");
    titleInput.focus();
    return;
  }

  if (title.length > 100) {
    setStatus("Titles must be 100 characters or fewer.", "error");
    titleInput.focus();
    return;
  }

  void createNote({ title, body: bodyInput.value.trim(), userId: 1 });
});

renderNotes(notes);
