"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_ACTIVE_KEY = "tour_active";
const DEFAULT_STEP_KEY = "tour_step";
const DEFAULT_STAGE_KEY = "tour_stage";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const readStep = (key) => {
  if (typeof window === "undefined") {
    return 0;
  }
  const raw = window.localStorage.getItem(key);
  const parsed = Number.parseInt(raw || "0", 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export default function TourOverlay({
  steps = [],
  labels = {},
  storageKey = DEFAULT_ACTIVE_KEY,
  stepKey = DEFAULT_STEP_KEY,
  stageKey = DEFAULT_STAGE_KEY,
  stage,
  onFinish,
  onStepChange
}) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [cardStyle, setCardStyle] = useState({});
  const [isCompact, setIsCompact] = useState(false);
  const highlightRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (window.localStorage.getItem(storageKey) === "1") {
      if (stage) {
        const storedStage = window.localStorage.getItem(stageKey);
        if (storedStage && storedStage !== stage) {
          return;
        }
        if (!storedStage && stage !== "home") {
          return;
        }
      }
      const nextStep = readStep(stepKey);
      setActive(true);
      setStepIndex(Math.min(nextStep, Math.max(steps.length - 1, 0)));
    }
  }, [storageKey, stepKey, stageKey, stage, steps.length]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const update = () => {
      setIsCompact(window.innerWidth <= 720 || window.innerHeight <= 640);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!active || typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(storageKey, "1");
    window.localStorage.setItem(stepKey, String(stepIndex));
    if (stage) {
      window.localStorage.setItem(stageKey, stage);
    }
  }, [active, stepIndex, storageKey, stepKey, stageKey, stage]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const previous = highlightRef.current;
    if (previous) {
      previous.classList.remove("tour-highlight");
      highlightRef.current = null;
    }
    const current = steps[stepIndex];
    if (!current) {
      return;
    }
    if (typeof onStepChange === "function") {
      onStepChange(current, stepIndex);
    }

    const updatePosition = () => {
      const margin = 16;
      const cardHeight = cardRef.current?.offsetHeight || 220;

      if (isCompact) {
        setCardStyle({});
        return;
      }

      const element = highlightRef.current;
      if (!element) {
        setCardStyle({
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          maxWidth: "360px"
        });
        return;
      }
      const rect = element.getBoundingClientRect();
      const cardWidth = Math.min(360, window.innerWidth - margin * 2);
      let left = rect.left;
      let top = rect.bottom + 14;

      if (top + cardHeight > window.innerHeight) {
        top = rect.top - cardHeight - 14;
      }
      left = clamp(left, margin, window.innerWidth - cardWidth - margin);
      top = clamp(top, margin, window.innerHeight - cardHeight - margin);

      setCardStyle({ top: `${top}px`, left: `${left}px`, maxWidth: `${cardWidth}px` });
    };

    if (isCompact) {
      updatePosition();
      window.addEventListener("resize", updatePosition);
      return () => {
        window.removeEventListener("resize", updatePosition);
      };
    }

    const applyHighlight = () => {
      const element = document.querySelector(`[data-tour="${current.key}"]`);
      if (element) {
        element.classList.add("tour-highlight");
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        highlightRef.current = element;
      }
      updatePosition();
    };

    const timer = setTimeout(applyHighlight, typeof onStepChange === "function" ? 80 : 0);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      if (highlightRef.current) {
        highlightRef.current.classList.remove("tour-highlight");
      }
    };
  }, [active, stepIndex, steps, onStepChange, isCompact]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.classList.add("tour-active");
    document.body.style.overflow = "hidden";
    return () => {
      document.body.classList.remove("tour-active");
      document.body.style.overflow = previousOverflow;
    };
  }, [active]);

  const stopTour = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
      window.localStorage.removeItem(stepKey);
      window.localStorage.removeItem(stageKey);
    }
    if (highlightRef.current) {
      highlightRef.current.classList.remove("tour-highlight");
      highlightRef.current = null;
    }
    setActive(false);
  };

  const goNext = () => {
    if (stepIndex >= steps.length - 1) {
      if (typeof onFinish === "function") {
        const result = onFinish();
        if (result === false || result === "continue") {
          return;
        }
      }
      stopTour();
      return;
    }
    setStepIndex((prev) => prev + 1);
  };

  const goBack = () => {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  if (!active || !steps.length) {
    return null;
  }

  const current = steps[stepIndex];
  if (!current) {
    return null;
  }

  const title = labels.title || "Tour";
  const stepLabel = labels.stepLabel || "Step";
  const backLabel = labels.back || "Back";
  const nextLabel = labels.next || "Next";
  const doneLabel = labels.done || "Done";
  const skipLabel = labels.skip || "Close";
  const currentTitle =
    isCompact && current.mobileTitle ? current.mobileTitle : current.title;
  const currentDesc =
    isCompact && current.mobileDesc ? current.mobileDesc : current.desc;

  return (
    <div className={`tour-overlay${isCompact ? " is-simple" : ""}`}>
      <div className="tour-card" style={cardStyle} ref={cardRef}>
        <div className="tour-step">
          {title} - {stepLabel} {stepIndex + 1}/{steps.length}
        </div>
        <div className="tour-title">{currentTitle}</div>
        <p className="tour-desc">{currentDesc}</p>
        <div className="tour-actions">
          <button type="button" className="button-secondary" onClick={stopTour}>
            {skipLabel}
          </button>
          <div className="tour-actions-main">
            <button type="button" className="button-secondary" onClick={goBack} disabled={stepIndex === 0}>
              {backLabel}
            </button>
            <button type="button" onClick={goNext}>
              {stepIndex >= steps.length - 1 ? doneLabel : nextLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
