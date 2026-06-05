import type { TRPCContext } from '@api/lib/trpc';
import type { createUserAuthenticationProcedure } from '@api/middleware/authentication';
import {
  dismissShare,
  getResultAccessInfo,
  getResultRow,
  getSharedWithMe,
  getSharesForResult,
  removeShare,
  searchUserByEmail,
  setResultPublic,
  upsertShare,
} from '@api/repository/db-sharing';
import { badRequest } from '@shared/utils/error-handlinginging';
import z from 'zod';

export function sharingRouter(
  router: TRPCContext['router'],
  authProcedure: ReturnType<typeof createUserAuthenticationProcedure>,
) {
  return router({
    // Recipient dismisses a result from their shared list
    dismissShare: authProcedure
      .input(z.object({ publicId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const result = await dismissShare(ctx.user.id, input.publicId);
        if (result.isErr()) throw result.error;
        return { dismissed: true };
      }),

    // Get the current user's access level for a result
    getResultAccess: authProcedure
      .input(z.object({ publicId: z.string() }))
      .query(async ({ ctx, input }) => {
        const result = await getResultAccessInfo(input.publicId, ctx.user.id);
        if (result.isErr()) throw result.error;
        if (!result.value?.hasAccess) {
          throw badRequest('Result not found');
        }
        return result.value;
      }),

    // Get all results shared with the current user (non-dismissed)
    getSharedWithMe: authProcedure.query(async ({ ctx }) => {
      const result = await getSharedWithMe(ctx.user.id);
      if (result.isErr()) throw result.error;
      return result.value;
    }),

    // Get all shares for a result (owner only)
    getSharesForResult: authProcedure
      .input(z.object({ publicId: z.string() }))
      .query(async ({ ctx, input }) => {
        const result = await getSharesForResult(input.publicId, ctx.user.id);
        if (result.isErr()) throw result.error;
        return result.value;
      }),

    // Remove a share (owner revokes access)
    removeShare: authProcedure
      .input(z.object({ publicId: z.string(), recipientUserId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const { publicId, recipientUserId } = input;

        const rowResult = await getResultRow(publicId);
        if (rowResult.isErr()) throw rowResult.error;
        if (rowResult.value?.creatorId !== ctx.user.id) {
          throw badRequest('Result not found');
        }

        const result = await removeShare(rowResult.value.id, recipientUserId);
        if (result.isErr()) throw result.error;
        return { removed: true };
      }),

    // Search for a user by email: used to confirm recipient before sharing
    searchUser: authProcedure
      .input(z.object({ email: z.string().email() }))
      .query(async ({ ctx, input }) => {
        const result = await searchUserByEmail(input.email, ctx.user.id);
        if (result.isErr()) throw result.error;
        return result.value;
      }),

    // Toggle public visibility (owner only)
    setPublic: authProcedure
      .input(z.object({ publicId: z.string(), isPublic: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const result = await setResultPublic(input.publicId, ctx.user.id, input.isPublic);
        if (result.isErr()) throw result.error;
        if (!result.value) throw badRequest('Result not found');
        return { isPublic: input.isPublic };
      }),

    // Share a result with a user by email
    shareResult: authProcedure
      .input(
        z.object({
          allowCopy: z.boolean(),
          email: z.string().email(),
          publicId: z.string(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { allowCopy, email, publicId } = input;

        const rowResult = await getResultRow(publicId);
        if (rowResult.isErr()) throw rowResult.error;
        if (rowResult.value?.creatorId !== ctx.user.id) {
          throw badRequest('Result not found');
        }
        const { id: backtestingResultsId } = rowResult.value;

        const recipientResult = await searchUserByEmail(email, ctx.user.id);
        if (recipientResult.isErr()) throw recipientResult.error;
        if (recipientResult.value == null) throw badRequest('User not found');

        const shareResult = await upsertShare(
          backtestingResultsId,
          recipientResult.value.id,
          allowCopy,
        );
        if (shareResult.isErr()) throw shareResult.error;
        return { shared: true };
      }),

    // Update share permissions
    updateShare: authProcedure
      .input(
        z.object({
          allowCopy: z.boolean(),
          publicId: z.string(),
          recipientUserId: z.string(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { allowCopy, publicId, recipientUserId } = input;

        const rowResult = await getResultRow(publicId);
        if (rowResult.isErr()) throw rowResult.error;
        if (rowResult.value?.creatorId !== ctx.user.id) {
          throw badRequest('Result not found');
        }

        const shareResult = await upsertShare(rowResult.value.id, recipientUserId, allowCopy);
        if (shareResult.isErr()) throw shareResult.error;
        return { updated: true };
      }),
  });
}
