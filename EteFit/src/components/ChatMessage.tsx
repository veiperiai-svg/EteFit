import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Dumbbell, User } from "lucide-react";
import type { Message } from "@/pages/Chat";

interface ChatMessageProps {
  message: Message;
}

const ChatMessage = ({ message }: ChatMessageProps) => {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-3 py-4 ${isUser ? "justify-end" : ""}`}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
          <Dumbbell className="w-4 h-4 text-primary" />
        </div>
      )}
      <div
        className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-card border border-border rounded-bl-md"
        }`}
      >
        {/* Show attached image */}
        {message.image && (
          <img
            src={message.image}
            alt="Attached"
            className="max-w-[240px] max-h-[240px] object-cover rounded-lg mb-2"
          />
        )}
        {isUser ? (
          <p className="text-sm leading-relaxed">{message.content}</p>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none text-foreground [&_h2]:text-foreground [&_h2]:font-heading [&_h2]:text-base [&_h2]:mt-1 [&_h2]:mb-2 [&_h3]:text-foreground [&_h3]:font-heading [&_h3]:text-sm [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:text-secondary-foreground [&_p]:text-sm [&_p]:leading-relaxed [&_li]:text-secondary-foreground [&_li]:text-sm [&_strong]:text-primary [&_blockquote]:border-l-primary [&_blockquote]:text-muted-foreground [&_table]:text-sm [&_th]:text-foreground [&_td]:text-secondary-foreground [&_code]:text-primary [&_a]:text-primary">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
    </motion.div>
  );
};

export default ChatMessage;
