import { useState, useEffect } from "react";
import { ArrowLeft, Trash2, Save } from "lucide-react";
import { hasConsented } from "@/hooks/useLocalStorage";
import { toast } from "sonner";

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary", desc: "Little to no exercise" },
  { value: "light", label: "Lightly Active", desc: "1–2 days/week" },
  { value: "moderate", label: "Moderately Active", desc: "3–5 days/week" },
  { value: "very", label: "Very Active", desc: "6–7 days/week" },
];

const GOALS = ["Lose weight", "Build muscle", "Improve endurance", "Stay healthy"];

interface SettingsPanelProps {
  onBack: () => void;
  onClearStorage: () => void;
}

const SettingsPanel = ({ onBack, onClearStorage }: SettingsPanelProps) => {
  const canSave = hasConsented();

  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [age, setAge] = useState("");
  const [activity, setActivity] = useState("");
  const [goal, setGoal] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("fitai-profile");
      if (stored) {
        const profile = JSON.parse(stored);
        setHeight(profile.height || "");
        setWeight(profile.weight || "");
        setAge(profile.age || "");
        setActivity(profile.activity || "");
        setGoal(profile.goal || "");
      }
    } catch {}
  }, []);

  const handleSave = () => {
    if (!canSave) {
      toast.error("Accept cookies first to save your data");
      return;
    }
    const profile = { height, weight, age, activity, goal };
    localStorage.setItem("fitai-profile", JSON.stringify(profile));
    toast.success("Profile updated!");
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Back button */}
      <div className="px-3 py-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-secondary-foreground hover:bg-secondary transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Chats
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-thin space-y-5">
        {/* Metrics */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Your Metrics
          </h3>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Height (cm)</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="175"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Weight (kg)</label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="70"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 text-sm"
              />
            </div>
          </div>

          <div className="mt-2">
            <label className="text-xs text-muted-foreground mb-1 block">Age</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="25"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 text-sm"
            />
          </div>
        </div>

        {/* Activity */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Activity Level</label>
          <div className="space-y-1.5">
            {ACTIVITY_LEVELS.map((level) => (
              <button
                key={level.value}
                onClick={() => setActivity(level.value)}
                className={`w-full p-2.5 rounded-lg border text-left transition-all text-xs ${
                  activity === level.value
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-secondary text-secondary-foreground hover:border-primary/30"
                }`}
              >
                <div className="font-medium">{level.label}</div>
                <div className="text-muted-foreground">{level.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Goal */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Fitness Goal</label>
          <div className="flex flex-wrap gap-1.5">
            {GOALS.map((g) => (
              <button
                key={g}
                onClick={() => setGoal(g)}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
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

        {/* Save button */}
        <button
          onClick={handleSave}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all"
        >
          <Save className="w-4 h-4" />
          Save Changes
        </button>

        {/* Danger zone */}
        <div className="pt-3 border-t border-border">
          <h3 className="text-xs font-semibold text-destructive uppercase tracking-wider mb-3">
            Danger Zone
          </h3>
          <button
            onClick={onClearStorage}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-destructive/30 text-destructive text-sm hover:bg-destructive/10 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Clear All Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
