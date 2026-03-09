import { hasConsented } from "@/hooks/useLocalStorage";

export type Conversation = {
  id: string;
  title: string;
  messages: { id: string; role: "user" | "assistant"; content: string }[];
  createdAt: number;
};

const STORAGE_KEY = "fitai-conversations";
const ACTIVE_KEY = "fitai-active-chat";

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

export function getConversations(): Conversation[] {
  if (!hasConsented()) return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveConversations(convos: Conversation[]) {
  if (!hasConsented()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convos));
}

export function getActiveConversationId(): string | null {
  return localStorage.getItem(ACTIVE_KEY) || sessionStorage.getItem(ACTIVE_KEY);
}

export function setActiveConversationId(id: string | null) {
  if (hasConsented()) {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } else {
    if (id) sessionStorage.setItem(ACTIVE_KEY, id);
    else sessionStorage.removeItem(ACTIVE_KEY);
  }
}

export function createConversation(firstMessage?: string): Conversation {
  const convo: Conversation = {
    id: generateId(),
    title: firstMessage?.slice(0, 40) || "New Chat",
    messages: [],
    createdAt: Date.now(),
  };
  const convos = getConversations();
  convos.unshift(convo);
  saveConversations(convos);
  setActiveConversationId(convo.id);
  return convo;
}

export function updateConversation(id: string, messages?: Conversation["messages"], title?: string) {
  if (!hasConsented()) return;
  const convos = getConversations();
  const idx = convos.findIndex((c) => c.id === id);
  if (idx !== -1) {
    if (messages) convos[idx].messages = messages;
    if (title) convos[idx].title = title;
    saveConversations(convos);
  }
}

export function deleteConversation(id: string) {
  const convos = getConversations().filter((c) => c.id !== id);
  saveConversations(convos);
  if (getActiveConversationId() === id) {
    setActiveConversationId(convos[0]?.id || null);
  }
}

// Migrate old single-chat format
export function migrateOldChats() {
  if (!hasConsented()) return;
  const oldChats = localStorage.getItem("fitai-chats");
  if (oldChats && !localStorage.getItem(STORAGE_KEY)) {
    try {
      const messages = JSON.parse(oldChats);
      if (messages.length > 0) {
        const convo: Conversation = {
          id: generateId(),
          title: messages[0]?.content?.slice(0, 40) || "Previous Chat",
          messages,
          createdAt: Date.now(),
        };
        saveConversations([convo]);
        setActiveConversationId(convo.id);
      }
      localStorage.removeItem("fitai-chats");
    } catch {}
  }
}
