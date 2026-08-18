import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * `success` usa `--gap-ok` — o mesmo token que já significa "adequado" no
 * badge de lacuna e na matriz de talentos — em vez do verde padrão do Sonner.
 * O objetivo é o cartão de sucesso soar como o mesmo "ok" do resto do app, não
 * como uma paleta importada por cima.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:border-l-4 group-[.toaster]:border-l-[var(--gap-ok-fg)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
