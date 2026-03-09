import { useState } from "react";
import { motion } from "framer-motion";
import { Navigate, useNavigate } from "react-router-dom";
import { Dumbbell, ArrowRight, SkipForward } from "lucide-react";
import { hasConsented, setOnboardingDone, hasCompletedOnboarding } from "@/hooks/useLocalStorage";

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary", desc: "Little to no exercise" },
  { value: "light", label: "Lightly Active", desc: "1–2 days/week" },
  { value: "moderate", label: "Moderately Active", desc: "3–5 days/week" },
  { value: "very", label: "Very Active", desc: "6–7 days/week" },
];

const GOALS = [
  "Lose weight",
  "Build muscle",
  "Improve endurance",
  "Stay healthy",
];

const Onboarding = () => {
  const navigate = useNavigate();
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [age, setAge] = useState("");
  const [activity, setActivity] = useState("");
  const [goal, setGoal] = useState("");

  // Instant redirect — no flash
  if (hasConsented() && hasCompletedOnboarding()) return <Navigate to="/chat" replace />;

  const handleSubmit = () => {
    if (hasConsented()) {
      const profile = { height, weight, age, activity, goal };
      localStorage.setItem("fitai-profile", JSON.stringify(profile));
    }
    setOnboardingDone();
    navigate("/chat");
  };

  const handleSkip = () => {
    setOnboardingDone();
    navigate("/chat");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="flex items-center justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Dumbbell className="w-7 h-7 text-primary" />
          </div>
        </div>

        <h2 className="font-heading text-2xl font-bold text-foreground text-center mb-1">
          Tell us about yourself
        </h2>
        <p className="text-muted-foreground text-sm text-center mb-8">
          This helps EteFit give you personalized advice. You can skip this.
        </p>

        <div className="space-y-5">
          {/* Height & Weight row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Height (cm)</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="175"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Weight (kg)</label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="70"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              />
            </div>
          </div>

          {/* Age */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Age</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="25"
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            />
          </div>

          {/* Activity level */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Activity Level</label>
            <div className="grid grid-cols-2 gap-2">
              {ACTIVITY_LEVELS.map((level) => (
                <button
                  key={level.value}
                  onClick={() => setActivity(level.value)}
                  className={`p-3 rounded-xl border text-left transition-all text-sm ${
                    activity === level.value
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-secondary text-secondary-foreground hover:border-primary/30"
                  }`}
                >
                  <div className="font-medium text-xs">{level.label}</div>
                  <div className="text-xs text-muted-foreground">{level.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Goal */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Fitness Goal</label>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <button
                  key={g}
                  onClick={() => setGoal(g)}
                  className={`px-4 py-2 rounded-full border text-xs font-medium transition-all ${
                    goal === g
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-secondary text-secondary-foreground hover:border-primary/30"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-8">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSubmit}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-primary-foreground font-heading font-semibold glow-primary hover:opacity-90 transition-all"
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </motion.button>
          <button
            onClick={handleSkip}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-muted-foreground text-sm hover:text-foreground transition-all"
          >
            <SkipForward className="w-4 h-4" />
            Skip for now
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Onboarding;
