import { prisma } from '@api/lib/prisma';
import type { TRPCContext } from '@api/lib/trpc';
import type { createUserAuthenticationProcedure } from '@api/middleware/authentication';
import { fromThrowableAsync, internal, type AppError } from '@api/utils/error-handling';
import { z } from 'zod';

export function usersRouter(
  router: TRPCContext['router'],
  authProcedure: ReturnType<typeof createUserAuthenticationProcedure>,
) {
  return router({
    deleteAccount: authProcedure.mutation(async ({ ctx }) => {
      // Delete user (cascade will delete sessions, accounts, etc.)
      const deleteUserResponse = await fromThrowableAsync(
        () =>
          prisma.user.delete({
            where: { id: ctx.user.id },
          }),
        (e) => internal(e, 'An unexpected error occurred while deleting the user'),
      );
      if (deleteUserResponse.isErr()) {
        throw deleteUserResponse.error;
      }
      return { success: true };
    }),
    getCurrentUser: authProcedure.query(async ({ ctx }) => {
      const getUserResponse = await fromThrowableAsync(
        () =>
          prisma.user.findUnique({
            where: { id: ctx.user.id },
          }),
        (e) => internal(e, 'An unexpected error occurred while retrieving the current user'),
      );
      if (getUserResponse.isErr()) {
        throw getUserResponse.error;
      }
      const user = getUserResponse.value;

      if (user == null) {
        throw {
          code: 'BAD_GATEWAY',
          message: 'The current user could does not exist',
        } satisfies AppError;
      }
      return { user };
    }),
    getProfileStats: authProcedure.query(async ({ ctx }) => {
      const getProfileStatsResponse = await fromThrowableAsync(
        () =>
          prisma.$transaction([
            prisma.algorithm.count({
              where: { creatorId: ctx.user.id },
            }),
            prisma.backtestingResults.count({
              where: { creatorId: ctx.user.id },
            }),
            prisma.backtestingShare.count({
              where: { userId: ctx.user.id },
            }),
          ]),
        (e) => internal(e, 'An unexpected error occurred while retrieving profile statistics'),
      );
      if (getProfileStatsResponse.isErr()) {
        throw getProfileStatsResponse.error;
      }
      const [numberOfAlgorithms, numberOfBacktestingResults, numberOfBacktestingShares] =
        getProfileStatsResponse.value;

      return {
        numberOfAlgorithms,
        numberOfBacktestingResults,
        numberOfBacktestingShares,
      };
    }),
    updateProfile: authProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100).optional(),
          image: z.string().optional().nullable(), // Accept base64 data URLs
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const updateData: { name?: string; image?: string | null } = {};

        if (input.name !== undefined) {
          updateData.name = input.name;
        }

        if (input.image !== undefined) {
          updateData.image = input.image;
        }

        const updateUserResponse = await fromThrowableAsync(
          () =>
            prisma.user.update({
              where: { id: ctx.user.id },
              data: updateData,
            }),
          (e) => internal(e, 'An unexpected error occurred while updating the user'),
        );
        if (updateUserResponse.isErr()) {
          throw updateUserResponse.error;
        }
        const updatedUser = updateUserResponse.value;
        return { updatedUser };
      }),
  });
}
