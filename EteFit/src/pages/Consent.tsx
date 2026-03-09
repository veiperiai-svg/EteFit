import { motion } from "framer-motion";
import { Cookie, Shield, ArrowRight, X } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { hasConsented, setConsent, hasCompletedOnboarding } from "@/hooks/useLocalStorage";

const Consent = () => {
  const navigate = useNavigate();

  // Instant redirect — no flash
  if (hasConsented() && hasCompletedOnboarding()) return <Navigate to="/chat" replace />;
  if (hasConsented()) return <Navigate to="/onboarding" replace />;

  const handleAccept = () => {
    setConsent(true);
    navigate("/onboarding");
  };

  const handleDecline = () => {
    // Don't save — consent screen will reappear next visit
    navigate("/onboarding");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md rounded-3xl bg-card border border-border p-8"
      >
        <div className="flex items-center justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Cookie className="w-7 h-7 text-primary" />
          </div>
        </div>

        <h2 className="font-heading text-2xl font-bold text-foreground text-center mb-2">
          Before we begin
        </h2>
        <p className="text-muted-foreground text-sm text-center mb-6">
          EteFit uses local storage to save your chats, body metrics, and preferences so they persist between sessions. No data is sent to third parties.
        </p>

        <div className="space-y-3 mb-8">
          {[
            { icon: Shield, text: "Data stays on your device" },
            { icon: Cookie, text: "Chat history saved locally" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-sm text-secondary-foreground">
              <Icon className="w-4 h-4 text-primary flex-shrink-0" />
              <span>{text}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleAccept}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-primary-foreground font-heading font-semibold glow-primary hover:opacity-90 transition-all"
          >
            Accept & Continue
            <ArrowRight className="w-4 h-4" />
          </motion.button>
          <button
            onClick={handleDecline}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 transition-all"
          >
            <X className="w-4 h-4" />
            Decline & Continue
          </button>
          <p className="text-xs text-muted-foreground text-center">
            If you decline, your data won't be saved between sessions.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Consent;
