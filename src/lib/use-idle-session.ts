import { useEffect, useRef, useState } from "react";

import {
  CrossTabIdleActivity,
  defaultIdleSessionBudget,
  IdleSessionMonitor,
  IdleSessionWatch,
  type IdleSessionBudget,
  type IdleSessionPhase,
} from "./idle-session";

export function useIdleSession({
  active,
  onEnd,
  budget = defaultIdleSessionBudget,
}: {
  active: boolean;
  onEnd: () => void;
  budget?: IdleSessionBudget;
}): IdleSessionPhase {
  const [phase, setPhase] = useState<IdleSessionPhase>("active");
  const endSession = useRef(onEnd);

  useEffect(() => {
    endSession.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    if (!active) {
      setPhase("active");
      return;
    }
    const watch = new IdleSessionWatch(
      new IdleSessionMonitor(budget, new CrossTabIdleActivity(), (next) => {
        setPhase(next);
        if (next === "ended") endSession.current();
      }),
    );
    watch.start();
    return () => watch.stop();
  }, [active, budget]);

  return phase;
}
