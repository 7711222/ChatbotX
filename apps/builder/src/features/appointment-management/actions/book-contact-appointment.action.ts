"use server"

import {
  AppointmentAlreadyScheduledException,
  AppointmentAvailabilityChangedException,
  appointmentService,
  conversationService,
  SlotUnavailableException,
} from "@chatbotx.io/business"
import { workspaceIdrequestParams } from "@/features/common/schema"
import { requireContactAccessForMember } from "@/features/contacts/permissions"
import { assertConversationAccessForCaller } from "@/lib/public-api/member-scope"
import { workspaceActionClient } from "@/lib/safe-action"
import { bookContactAppointmentRequest } from "../schema/action"

/**
 * Books a slot for a contact from the inbox's contact panel. Same booking
 * path as the webview and public `appointments.book`; like the latter, the
 * confirmation flow and reminders reach the contact only when both
 * `conversationId` and `inboxId` are given — otherwise the booking is silent.
 */
export const bookContactAppointmentAction = workspaceActionClient
  .bindArgsSchemas(workspaceIdrequestParams)
  .inputSchema(bookContactAppointmentRequest)
  .action(async ({ bindArgsParsedInputs: [workspaceId], parsedInput, ctx }) => {
    await requireContactAccessForMember({
      permissions: ctx.workspaceMemberPermissions,
      userId: ctx.user.id,
      workspaceId,
      contactId: parsedInput.contactId,
    })

    let contactInboxId: string | undefined
    if (parsedInput.conversationId) {
      const conversation = await assertConversationAccessForCaller(
        {
          workspace: ctx.workspace,
          member: ctx.workspaceMember,
          user: ctx.user,
        },
        parsedInput.conversationId,
      )
      if (parsedInput.inboxId) {
        const contactInbox =
          await conversationService.resolveContactInboxForConversation({
            conversation,
            workspaceId,
            inboxId: parsedInput.inboxId,
          })
        contactInboxId = contactInbox.id
      }
    }

    try {
      const appointment = await appointmentService.bookAppointment({
        workspaceId,
        calendarId: parsedInput.calendarId,
        contactId: parsedInput.contactId,
        conversationId: parsedInput.conversationId,
        contactInboxId,
        startAt: new Date(parsedInput.startAt),
        inviteeTimezone: parsedInput.inviteeTimezone,
      })
      return {
        appointment: { id: appointment.id },
        completed: true,
        staleSlot: false,
        availabilityChanged: false,
      }
    } catch (error) {
      if (
        error instanceof SlotUnavailableException ||
        error instanceof AppointmentAlreadyScheduledException
      ) {
        return {
          appointment: null,
          completed: false,
          staleSlot: true,
          availabilityChanged: false,
        }
      }
      if (error instanceof AppointmentAvailabilityChangedException) {
        return {
          appointment: null,
          completed: false,
          staleSlot: false,
          availabilityChanged: true,
        }
      }
      throw error
    }
  })
