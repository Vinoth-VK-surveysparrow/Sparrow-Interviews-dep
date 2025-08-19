import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/ThemeProvider"
import { Monitor, Moon, Sun, ChevronDown } from "lucide-react"

const themeVariants = cva(
  "inline-flex items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background",
  {
    variants: {
      variant: {
        dropdown: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        sm: "h-8 px-2 text-xs",
        md: "h-9 px-3 text-sm",
        lg: "h-10 px-4 text-sm",
      },
    },
    defaultVariants: {
      variant: "dropdown",
      size: "md",
    },
  }
)

interface ThemeProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof themeVariants> {
  themes: Array<"light" | "dark" | "system">
  showLabel?: boolean
}

const themeIcons = {
  light: <Sun className="h-4 w-4" />,
  dark: <Moon className="h-4 w-4" />,
  system: <Monitor className="h-4 w-4" />,
}

const themeLabels = {
  light: "Light",
  dark: "Dark", 
  system: "System",
}

function Theme({
  className,
  variant,
  size,
  themes,
  showLabel = false,
  ...props
}: ThemeProps) {
  const { theme, setTheme } = useTheme()

  const currentTheme = theme || "system"
  const currentIcon = themeIcons[currentTheme as keyof typeof themeIcons]
  const currentLabel = themeLabels[currentTheme as keyof typeof themeLabels]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size === "md" ? "default" : size}
          className={cn(themeVariants({ variant, size, className }))}
          {...props}
        >
          <span className="flex items-center gap-2">
            {currentIcon}
            {showLabel && <span>{currentLabel}</span>}
            <ChevronDown className="h-3 w-3" />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {themes.map((themeOption) => (
          <DropdownMenuItem
            key={themeOption}
            onClick={() => setTheme(themeOption)}
            className="flex items-center gap-2"
          >
            {themeIcons[themeOption]}
            {themeLabels[themeOption]}
            {currentTheme === themeOption && (
              <span className="ml-auto text-xs">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { Theme, themeVariants }
export type { ThemeProps }