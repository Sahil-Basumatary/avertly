"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

function Sheet(props: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content>) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/65 data-[state=closed]:duration-150 data-[state=open]:duration-200 lg:hidden" />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 max-h-[84dvh] overflow-y-auto rounded-t-xl border-t border-white/15 bg-[#0d0e10] px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] outline-none data-[state=closed]:duration-150 data-[state=open]:duration-200 lg:hidden",
          className,
        )}
        {...props}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        {children}
        <SheetPrimitive.Close className="absolute top-4 right-4 rounded-md p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
          <X className="size-4" />
          <span className="sr-only">Close details</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      className={cn("text-lg font-medium text-white", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      className={cn("text-sm text-zinc-400", className)}
      {...props}
    />
  );
}

export { Sheet, SheetContent, SheetDescription, SheetTitle };
