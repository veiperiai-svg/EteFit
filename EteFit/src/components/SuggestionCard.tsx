import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface SuggestionCardProps {
  icon: LucideIcon;
  title: string;
  delay?: number;
  onClick: () => void;
}

const SuggestionCard = ({ icon: Icon, title, delay = 0, onClick }: SuggestionCardProps) => {
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 + delay }}
      onClick={onClick}
      className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-secondary transition-all text-left group cursor-pointer"
    >
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <span className="text-sm font-medium text-foreground">{title}</span>
    </motion.button>
  );
};

export default SuggestionCard;
