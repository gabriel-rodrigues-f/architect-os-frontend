"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 duration-(--motion-base) ease-standard data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * O botão de fechar de diálogo e painel ([F-04], [A-01]): nome pelo i18n
 * (era "Close" em `sr-only`, fora do alcance da catraca de idioma), distinto
 * do "Fechar" que um rodapé pode ter — o leitor de tela não ouve dois iguais —
 * e o anel
 * da casa por `focus-visible`. Um componente para os dois — o `Sheet` usa a
 * mesma primitiva Radix.
 */
const OverlayCloseButton = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>
>(({ className, ...props }, ref) => {
  const { t } = useI18n();
  return (
    <DialogPrimitive.Close
      ref={ref}
      className={cn(
        "absolute right-4 top-4 rounded-sm opacity-70 cursor-pointer transition-opacity hover:opacity-100 focus-visible:focus-ring disabled:pointer-events-none",
        className,
      )}
      {...props}
    >
      <X className="size-4" aria-hidden="true" />
      <span className="sr-only">{t("dialog.close")}</span>
    </DialogPrimitive.Close>
  );
});
OverlayCloseButton.displayName = "OverlayCloseButton";

/**
 * Três tamanhos nomeados ([F-04]): `sm` 400 (confirmação), `md` 512 (o
 * padrão, formulário curto), `lg` 672 (formulário longo — era `max-w-2xl`
 * copiado em 6 rotas). Todos com rolagem interna a 85vh: o formulário longo
 * rola por dentro, o cabeçalho fica. A sombra é `--elevation-overlay`.
 */
const dialogContentVariants = cva(
  "fixed left-[50%] top-[50%] z-50 grid w-[calc(100vw-2rem)] max-h-[85vh] translate-x-[-50%] translate-y-[-50%] gap-4 scroll-visible overflow-y-auto border bg-background p-6 shadow-(--elevation-overlay) duration-(--motion-base) ease-standard data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg",
  {
    variants: {
      size: {
        sm: "max-w-[400px]",
        md: "max-w-lg",
        lg: "max-w-2xl",
      },
    },
    defaultVariants: { size: "md" },
  },
);

type DialogSize = NonNullable<VariantProps<typeof dialogContentVariants>["size"]>;

interface DialogContentProps
  extends
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof dialogContentVariants> {}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, size, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(dialogContentVariants({ size }), className)}
      {...props}
    >
      {children}
      <OverlayCloseButton />
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-section font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-body text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  OverlayCloseButton,
  type DialogSize,
};
