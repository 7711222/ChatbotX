import { useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { orpc } from "@/lib/orpc/query"

/**
 * Call after an appointment is created so the contact panel list and any open
 * availability picker refetch. `router.refresh()` does not touch the TanStack
 * cache (AGENTS.md invariant 21).
 */
export const useInvalidateAppointments = () => {
  const queryClient = useQueryClient()
  return useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: orpc.appointmentsAPI.key(),
        }),
        queryClient.invalidateQueries({
          queryKey:
            orpc.appointmentCalendarsAPI.getContactAvailabilityAPI.key(),
        }),
      ]),
    [queryClient],
  )
}
