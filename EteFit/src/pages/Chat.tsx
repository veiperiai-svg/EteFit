import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Dumbbell, Heart, Brain, Sparkles, Menu, ImagePlus, X } from "lucide-react";
import { Navigate } from "react-router-dom";
import ChatMessage from "@/components/ChatMessage";
import ChatSidebar from "@/components/ChatSidebar";
import SuggestionCard from "@/components/SuggestionCard";
import { toast } from "sonner";
import { hasConsented, hasCompletedOnboarding } from "@/hooks/useLocalStorage";
import {
  getConversations,
  getActiveConversationId,
  setActiveConversationId,
  createConversation,
  updateConversation,
  deleteConversation,
  migrateOldChats,
  type Conversation,
} from "@/lib/chatStorage";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string; // base64 data URL for user-attached images
};

const SUGGESTIONS = [
  {
    icon: Dumbbell,
    title: "Workout Plan",
    prompt: "Create a 4-day workout plan for building muscle at home with minimal equipment",
  },
  {
    icon: Heart,
    title: "Nutrition Tips",
    prompt: "What should I eat before and after a workout for maximum results?",
  },
  {
    icon: Brain,
    title: "Recovery",
    prompt: "How can I improve my sleep and recovery between training sessions?",
  },
  {
    icon: Sparkles,
    title: "Habit Tracker",
    prompt: "Help me build a daily fitness and wellness habit checklist",
  },
];

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function getUserProfile() {
  try {
    const stored = localStorage.getItem("fitai-profile");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

const CHAT_URL = "/.netlify/functions/chat";

async function streamChat({
  messages,
  userProfile,
  onDelta,
  onDone,
  onError,
}: {
  messages: { role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }[];
  userProfile?: Record<string, string> | null;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, userProfile }),
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    onError(data.error || "Something went wrong");
    return;
  }

  if (!resp.body) {
    onError("No response stream");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done = false;

  while (!done) {
    const { done: readerDone, value } = await reader.read();
    if (readerDone) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const json = line.slice(6).trim();
      if (json === "[DONE]") {
        done = true;
        break;
      }

      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }

  if (buffer.trim()) {
    for (let raw of buffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (!raw.startsWith("data: ")) continue;
      const json = raw.slice(6).trim();
      if (json === "[DONE]") continue;
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {}
    }
  }

  onDone();
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const ChatGuard = () => {
  if (!hasCompletedOnboarding()) return <Navigate to="/" replace />;
  return <ChatInner />;
};

const ChatInner = () => {
  const canSave = hasConsented();

  useEffect(() => {
    migrateOldChats();
  }, []);

  const [conversations, setConversations] = useState<Conversation[]>(() => getConversations());
  const [activeId, setActiveId] = useState<string | null>(() => getActiveConversationId());
  const [messages, setMessages] = useState<Message[]>(() => {
    const id = getActiveConversationId();
    if (id) {
      const convo = getConversations().find((c) => c.id === id);
      return convo?.messages || [];
    }
    return [];
  });
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (canSave && activeId && messages.length > 0) {
      const title = messages[0]?.content?.slice(0, 40);
      updateConversation(activeId, messages, title);
      setConversations(getConversations());
    }
  }, [messages, activeId, canSave]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleNewChat = useCallback(() => {
    const convo = createConversation();
    setActiveId(convo.id);
    setMessages([]);
    setConversations(getConversations());
  }, []);

  const handleSelectChat = useCallback((id: string) => {
    setActiveConversationId(id);
    setActiveId(id);
    const convo = getConversations().find((c) => c.id === id);
    setMessages(convo?.messages || []);
  }, []);

  const handleDeleteChat = useCallback(
    (id: string) => {
      deleteConversation(id);
      const remaining = getConversations();
      setConversations(remaining);
      if (activeId === id) {
        if (remaining.length > 0) {
          handleSelectChat(remaining[0].id);
        } else {
          setActiveId(null);
          setActiveConversationId(null);
          setMessages([]);
        }
      }
    },
    [activeId, handleSelectChat]
  );

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setPendingImage(base64);
    } catch {
      toast.error("Failed to read image");
    }

    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if ((!messageText && !pendingImage) || isTyping) return;

    let currentId = activeId;
    if (!currentId) {
      const convo = createConversation(messageText || "Image analysis");
      currentId = convo.id;
      setActiveId(convo.id);
      setConversations(getConversations());
    }

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: messageText || "Analyze this image",
      image: pendingImage || undefined,
    };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setPendingImage(null);
    setIsTyping(true);

    // Build messages for API - use multimodal content format when image is present
    const apiMessages = newMessages.map((m) => {
      if (m.image) {
        const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
        if (m.content) {
          content.push({ type: "text", text: m.content });
        }
        content.push({
          type: "image_url",
          image_url: { url: m.image },
        });
        return { role: m.role, content };
      }
      return { role: m.role, content: m.content };
    });

    let assistantContent = "";
    const assistantId = generateId();
    let renderQueue = "";
    let streamDone = false;
    let finalized = false;
    let flushTimer: number | null = null;
    let buffering = true;
    let deltaCount = 0;

    const finalizeStreaming = () => {
      if (finalized) return;
      finalized = true;
      setIsTyping(false);

      if (currentId && newMessages.length === 1 && assistantContent.trim()) {
        const allMsgs = [...newMessages, { role: "assistant", content: assistantContent }];
        fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            generateTitle: true,
            messages: allMsgs.map((m) => ({ role: m.role, content: m.content })),
          }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.title && currentId) {
              updateConversation(currentId, undefined, data.title);
              setConversations(getConversations());
            }
          })
          .catch(() => {});
      }
    };

    const stopFlusher = () => {
      if (flushTimer !== null) {
        window.clearInterval(flushTimer);
        flushTimer = null;
      }
    };

    const renderTick = () => {
      if (renderQueue.length === 0) {
        if (streamDone) {
          stopFlusher();
          finalizeStreaming();
        }
        return;
      }

      const queueLen = renderQueue.length;
      const chunkSize = queueLen > 200 ? 120 : queueLen > 80 ? 60 : queueLen > 30 ? 25 : 12;
      const toRender = renderQueue.slice(0, chunkSize);
      renderQueue = renderQueue.slice(chunkSize);
      assistantContent += toRender;
      const content = assistantContent;

      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.id === assistantId) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content } : m));
        }
        return [...prev, { id: assistantId, role: "assistant", content }];
      });
    };

    const startFlusher = () => {
      if (flushTimer !== null) return;
      flushTimer = window.setInterval(renderTick, 16);
    };

    await streamChat({
      messages: apiMessages,
      userProfile: getUserProfile(),
      onDelta: (chunk) => {
        renderQueue += chunk;
        deltaCount++;
        if (buffering && deltaCount >= 4) {
          buffering = false;
          startFlusher();
        } else if (!buffering) {
          startFlusher();
        }
      },
      onDone: () => {
        streamDone = true;
        buffering = false;
        startFlusher();
      },
      onError: (msg) => {
        toast.error(msg);
        streamDone = true;
        stopFlusher();
        setIsTyping(false);
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const showWelcome = messages.length === 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <ChatSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelectChat}
        onNew={handleNewChat}
        onDelete={handleDeleteChat}
        onClearAll={() => {
          localStorage.clear();
          sessionStorage.clear();
          window.location.href = "/";
        }}
      />

      <header className="flex items-center gap-3 px-4 md:px-6 py-4 border-b border-border/50 backdrop-blur-md bg-background/80 z-10">
        <button
          onClick={() => setSidebarOpen(true)}
          className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
        >
          <Menu className="w-5 h-5 text-foreground" />
        </button>
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center glow-primary">
          <Dumbbell className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-heading text-lg font-semibold text-foreground">EteFit</h1>
          <p className="text-xs text-muted-foreground">Your AI fitness & health coach</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
          <span className="text-xs text-muted-foreground">Online</span>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-6 scrollbar-thin">
        <div className="max-w-3xl mx-auto">
          <AnimatePresence>
            {showWelcome && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col items-center justify-center min-h-[60vh] text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                  className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 glow-primary"
                >
                  <Dumbbell className="w-10 h-10 text-primary" />
                </motion.div>
                <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-3">
                  Hey, I'm <span className="text-gradient">EteFit</span>
                </h2>
                <p className="text-muted-foreground text-lg mb-10 max-w-md">
                  Your personal AI coach for workouts, nutrition, recovery, and wellness.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                  {SUGGESTIONS.map((s, i) => (
                    <SuggestionCard
                      key={s.title}
                      icon={s.icon}
                      title={s.title}
                      delay={i * 0.1}
                      onClick={() => handleSend(s.prompt)}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}

            {isTyping && messages[messages.length - 1]?.role !== "assistant" && (
              <motion.div
                key="typing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 py-4"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Dumbbell className="w-4 h-4 text-primary" />
                </div>
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="w-2 h-2 rounded-full bg-primary/60"
                      animate={{ y: [0, -6, 0] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-border/50 backdrop-blur-md bg-background/80 px-4 md:px-6 py-4">
        <div className="max-w-3xl mx-auto">
          {/* Pending image preview */}
          {pendingImage && (
            <div className="mb-3 relative inline-block">
              <img
                src={pendingImage}
                alt="Attached"
                className="h-20 w-20 object-cover rounded-xl border border-border"
              />
              <button
                onClick={() => setPendingImage(null)}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:opacity-80 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isTyping}
              className="w-11 h-11 rounded-xl bg-secondary border border-border flex items-center justify-center hover:bg-secondary/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Attach image"
            >
              <ImagePlus className="w-5 h-5 text-muted-foreground" />
            </button>
            <div className="flex-1">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={pendingImage ? "Describe what you want to know about this image..." : "Ask about workouts, nutrition, recovery..."}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all font-body text-sm"
              />
            </div>
            <button
              onClick={() => handleSend()}
              disabled={(!input.trim() && !pendingImage) || isTyping}
              className="w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed glow-primary"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground/60 text-center mt-2">
          This information may be inaccurate. Please verify it from reliable sources.
        </p>
      </div>
    </div>
  );
};

export default ChatGuard;
