import * as React from "react"

import type {
  CenteredToastActionElement,
  CenteredToastProps,
} from "@/components/ui/centered-toast"

const CENTERED_TOAST_LIMIT = 1
const CENTERED_TOAST_REMOVE_DELAY = 5000 // 5 seconds for centered toasts

type CenteredToasterToast = CenteredToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: CenteredToastActionElement
}

const centeredActionTypes = {
  ADD_CENTERED_TOAST: "ADD_CENTERED_TOAST",
  UPDATE_CENTERED_TOAST: "UPDATE_CENTERED_TOAST",
  DISMISS_CENTERED_TOAST: "DISMISS_CENTERED_TOAST",
  REMOVE_CENTERED_TOAST: "REMOVE_CENTERED_TOAST",
} as const

let centeredCount = 0

function centeredGenId() {
  centeredCount = (centeredCount + 1) % Number.MAX_SAFE_INTEGER
  return centeredCount.toString()
}

type CenteredActionType = typeof centeredActionTypes

type CenteredAction =
  | {
      type: CenteredActionType["ADD_CENTERED_TOAST"]
      toast: CenteredToasterToast
    }
  | {
      type: CenteredActionType["UPDATE_CENTERED_TOAST"]
      toast: Partial<CenteredToasterToast>
    }
  | {
      type: CenteredActionType["DISMISS_CENTERED_TOAST"]
      toastId?: CenteredToasterToast["id"]
    }
  | {
      type: CenteredActionType["REMOVE_CENTERED_TOAST"]
      toastId?: CenteredToasterToast["id"]
    }

interface CenteredState {
  toasts: CenteredToasterToast[]
}

const centeredToastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addCenteredToRemoveQueue = (toastId: string) => {
  if (centeredToastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    centeredToastTimeouts.delete(toastId)
    centeredDispatch({
      type: "REMOVE_CENTERED_TOAST",
      toastId: toastId,
    })
  }, CENTERED_TOAST_REMOVE_DELAY)

  centeredToastTimeouts.set(toastId, timeout)
}

export const centeredReducer = (state: CenteredState, action: CenteredAction): CenteredState => {
  switch (action.type) {
    case "ADD_CENTERED_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, CENTERED_TOAST_LIMIT),
      }

    case "UPDATE_CENTERED_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_CENTERED_TOAST": {
      const { toastId } = action

      if (toastId) {
        addCenteredToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addCenteredToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_CENTERED_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const centeredListeners: Array<(state: CenteredState) => void> = []

let centeredMemoryState: CenteredState = { toasts: [] }

function centeredDispatch(action: CenteredAction) {
  centeredMemoryState = centeredReducer(centeredMemoryState, action)
  centeredListeners.forEach((listener) => {
    listener(centeredMemoryState)
  })
}

type CenteredToast = Omit<CenteredToasterToast, "id">

function centeredToast({ ...props }: CenteredToast) {
  const id = centeredGenId()

  const update = (props: CenteredToasterToast) =>
    centeredDispatch({
      type: "UPDATE_CENTERED_TOAST",
      toast: { ...props, id },
    })
  const dismiss = () => centeredDispatch({ type: "DISMISS_CENTERED_TOAST", toastId: id })

  centeredDispatch({
    type: "ADD_CENTERED_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

function useCenteredToast() {
  const [state, setState] = React.useState<CenteredState>(centeredMemoryState)

  React.useEffect(() => {
    centeredListeners.push(setState)
    return () => {
      const index = centeredListeners.indexOf(setState)
      if (index > -1) {
        centeredListeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast: centeredToast,
    dismiss: (toastId?: string) => centeredDispatch({ type: "DISMISS_CENTERED_TOAST", toastId }),
  }
}

export { useCenteredToast, centeredToast }
