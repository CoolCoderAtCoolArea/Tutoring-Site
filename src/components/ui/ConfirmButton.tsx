"use client";
import type { ComponentProps } from "react";
import { Button } from "./Button";

/** A submit button that asks "Are you sure?" first (for deleting things). */
export function ConfirmButton({ confirm, ...props }: ComponentProps<typeof Button> & { confirm: string }) {
  return (
    <Button
      type="submit"
      {...props}
      onClick={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    />
  );
}
