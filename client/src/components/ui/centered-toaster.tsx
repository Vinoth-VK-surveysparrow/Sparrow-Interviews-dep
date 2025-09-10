import { useCenteredToast } from "@/hooks/use-centered-toast"
import {
  CenteredToast,
  CenteredToastClose,
  CenteredToastDescription,
  CenteredToastProvider,
  CenteredToastTitle,
  CenteredToastViewport,
} from "@/components/ui/centered-toast"

export function CenteredToaster() {
  const { toasts } = useCenteredToast()

  return (
    <CenteredToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <CenteredToast key={id} {...props}>
            <div className="grid gap-1">
              {title && <CenteredToastTitle>{title}</CenteredToastTitle>}
              {description && (
                <CenteredToastDescription>{description}</CenteredToastDescription>
              )}
            </div>
            {action}
            <CenteredToastClose />
          </CenteredToast>
        )
      })}
      <CenteredToastViewport />
    </CenteredToastProvider>
  )
}
