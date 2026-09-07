import * as React from "react";

import { cn } from "@/lib/utils";
import { FieldControl } from "./field-control";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(FieldControl.moldura, "min-h-[60px] px-3 py-2", className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
