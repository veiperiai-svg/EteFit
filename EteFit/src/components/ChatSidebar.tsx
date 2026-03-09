import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Plus, Trash2, X, Settings, AlertTriangle } from "lucide-react";
import type { Conversation } from "@/lib/chatStorage";
import SettingsPanel from "@/components/SettingsPanel";

interface ChatSidebarProps {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

const ChatSidebar = ({
  open,
  onClose,
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onClearAll,
}: ChatSidebarProps) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showClearWarning, setShowClearWarning] = useState(false);
  const [deleteChatId, setDeleteChatId] = useState<string | null>(null);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-0 top-0 bottom-0 w-72 bg-card border-r border-border z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-border">
              <h2 className="font-heading text-sm font-semibold text-foreground">
                {showSettings ? "Settings" : "Chats"}
              </h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {showSettings ? (
              <SettingsPanel
                onBack={() => setShowSettings(false)}
                onClearStorage={() => setShowClearWarning(true)}
              />
            ) : (
              <>
                {/* New chat button */}
                <div className="px-3 py-3">
                  <button
                    onClick={() => {
                      onNew();
                      onClose();
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    New Chat
                  </button>
                </div>

                {/* Chat list */}
                <div className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-thin">
                  {conversations.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      No conversations yet
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {conversations.map((convo) => (
                        <div
                          key={convo.id}
                          className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-sm ${
                            activeId === convo.id
                              ? "bg-primary/10 text-foreground border border-primary/20"
                              : "text-secondary-foreground hover:bg-secondary"
                          }`}
                          onClick={() => {
                            onSelect(convo.id);
                            onClose();
                          }}
                        >
                          <MessageSquare className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                          <span className="flex-1 truncate">{convo.title}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteChatId(convo.id);
                            }}
                            className="w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-3 py-3 border-t border-border space-y-2">
                  <button
                    onClick={() => setShowSettings(true)}
                    className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm text-secondary-foreground hover:bg-secondary transition-all"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </button>
                  <p className="text-[11px] text-muted-foreground/60 text-center">
                    Designed by{" "}
                    <a
                      href="https://etevox.netlify.app/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary/70 hover:text-primary transition-colors"
                    >
                      Etevox
                    </a>
                  </p>
                </div>
              </>
            )}
          </motion.div>

          {/* Clear storage warning modal */}
          <AnimatePresence>
            {showClearWarning && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-center justify-center px-4"
              >
                <div className="absolute inset-0 bg-black/60" onClick={() => setShowClearWarning(false)} />
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="relative w-full max-w-sm rounded-2xl bg-card border border-border p-6 z-10"
                >
                  <div className="flex items-center justify-center mb-4">
                    <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-destructive" />
                    </div>
                  </div>
                  <h3 className="font-heading text-lg font-bold text-foreground text-center mb-2">
                    Clear All Data?
                  </h3>
                  <p className="text-sm text-muted-foreground text-center mb-6">
                    This will permanently delete all your chats, profile data, and preferences. You'll be taken back to the welcome screen. This action cannot be undone.
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        setShowClearWarning(false);
                        onClearAll();
                      }}
                      className="w-full py-3 rounded-xl bg-destructive text-destructive-foreground font-medium text-sm hover:opacity-90 transition-all"
                    >
                      Yes, Clear Everything
                    </button>
                    <button
                      onClick={() => setShowClearWarning(false)}
                      className="w-full py-3 rounded-xl bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Delete chat warning modal */}
          <AnimatePresence>
            {deleteChatId && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-center justify-center px-4"
              >
                <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteChatId(null)} />
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="relative w-full max-w-sm rounded-2xl bg-card border border-border p-6 z-10"
                >
                  <div className="flex items-center justify-center mb-4">
                    <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                      <Trash2 className="w-6 h-6 text-destructive" />
                    </div>
                  </div>
                  <h3 className="font-heading text-lg font-bold text-foreground text-center mb-2">
                    Delete Chat?
                  </h3>
                  <p className="text-sm text-muted-foreground text-center mb-6">
                    This chat and all its messages will be permanently deleted. This action cannot be undone.
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        onDelete(deleteChatId);
                        setDeleteChatId(null);
                      }}
                      className="w-full py-3 rounded-xl bg-destructive text-destructive-foreground font-medium text-sm hover:opacity-90 transition-all"
                    >
                      Yes, Delete
                    </button>
                    <button
                      onClick={() => setDeleteChatId(null)}
                      className="w-full py-3 rounded-xl bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
};

export default ChatSidebar;
