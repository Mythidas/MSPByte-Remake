"use client";

import { Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { type ComponentProps } from "react";
import { useFormStatus } from "react-dom";

type Props = ComponentProps<typeof Button> & {
  pending?: boolean;
};

export function SubmitButton({ children, disabled, pending, ...props }: Props) {
  const { pending: status } = useFormStatus();

  const isDisabled = disabled || status || pending;

  return (
    <Button
      type="submit"
      aria-disabled={isDisabled}
      disabled={isDisabled}
      {...props}
    >
      {(status || pending) && <Spinner size={18} />} {children}
    </Button>
  );
}
