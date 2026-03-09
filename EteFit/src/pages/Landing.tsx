import { motion } from "framer-motion";
import { Dumbbell, ArrowRight, Zap, Heart, Brain } from "lucide-react";
import { useNavigate, Navigate } from "react-router-dom";
import { hasConsented, hasCompletedOnboarding } from "@/hooks/useLocalStorage";
import gymBg from "@/assets/gym-bg.jpg";

const Landing = () => {
  const navigate = useNavigate();

  // Instant redirect if already completed flow
  if (hasConsented() && hasCompletedOnboarding()) return <Navigate to="/chat" replace />;
  if (hasConsented()) return <Navigate to="/onboarding" replace />;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-background">
      {/* Blurred gym background */}
      <div
        className="absolute inset-0 bg-cover bg-center blur-sm scale-105 opacity-25 pointer-events-none"
        style={{ backgroundImage: `url(${gymBg})` }}
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-background/70 pointer-events-none" />
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="flex flex-col items-center text-center px-6 z-10"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 180, delay: 0.2 }}
          className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-8 glow-primary"
        >
          <Dumbbell className="w-12 h-12 text-primary" />
        </motion.div>

        {/* Title */}
        <h1 className="font-heading text-5xl md:text-7xl font-bold text-foreground mb-4">
          Ete<span className="text-gradient">Fit</span>
        </h1>

        {/* Tagline */}
        <p className="text-muted-foreground text-lg md:text-xl max-w-md mb-4">
          Your personal AI-powered fitness &amp; wellness assistant
        </p>
        <p className="text-muted-foreground/70 text-sm max-w-sm mb-10">
          Get tailored workout plans, nutrition advice, recovery tips, and track your fitness journey — all in one place.
        </p>

        {/* Get Started */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate("/consent")}
          className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-heading font-semibold text-lg glow-primary hover:opacity-90 transition-all"
        >
          Get Started
          <ArrowRight className="w-5 h-5" />
        </motion.button>

        {/* Features row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="flex flex-wrap justify-center gap-6 mt-16"
        >
          {[
            { icon: Zap, label: "Smart Workouts" },
            { icon: Heart, label: "Nutrition Plans" },
            { icon: Brain, label: "Recovery Coach" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-muted-foreground text-sm">
              <Icon className="w-4 h-4 text-primary" />
              <span>{label}</span>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Landing;
