import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { configurationCatalog } from "./configuration-queries";
import {
  CrossTabIdleActivity,
  IdleSessionBudget,
  IdleSessionMonitor,
  IdleSessionWatch,
  type IdleSessionPhase,
} from "./idle-session";
import { EffectiveOperationalSettings } from "./operational-settings";

export function useIdleSession({
  active,
  onEnd,
}: {
  active: boolean;
  onEnd: () => void;
}): IdleSessionPhase {
  const [phase, setPhase] = useState<IdleSessionPhase>("active");
  const endSession = useRef(onEnd);

  const { data: idleTimeoutMinutes } = useQuery({
    ...configurationCatalog.operationalSettings.options,
    select: (loaded) => EffectiveOperationalSettings.resolve(loaded).sessionIdleTimeoutMinutes,
  });

  const budget = useMemo(
    () =>
      idleTimeoutMinutes === undefined
        ? null
        : IdleSessionBudget.fromIdleTimeoutMinutes(idleTimeoutMinutes),
    [idleTimeoutMinutes],
  );

  useEffect(() => {
    endSession.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    if (!active || budget === null) {
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
