import { prisma } from '@api/lib/prisma';
import type { TRPCContext } from '@api/lib/trpc';
import type { createUserAuthenticationProcedure } from '@api/middleware/authentication';
import { tryAsync } from '@api/utils/error-handling';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

export function usersRouter(
  router: TRPCContext['router'],
  authProcedure: ReturnType<typeof createUserAuthenticationProcedure>,
) {
  return router({
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

        const updateUserResponse = await tryAsync(() =>
          prisma.user.update({
            where: { id: ctx.user.id },
            data: updateData,
          }),
        );
        if (!updateUserResponse.ok) {
          console.error(`[${ctx.req.path}]`, updateUserResponse.error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred while updating the user',
          });
        }
        const updatedUser = updateUserResponse.data;
        return { updatedUser };
      }),
    getCurrentUser: authProcedure.query(async ({ ctx }) => {
      const getUserResponse = await tryAsync(() =>
        prisma.user.findUnique({
          where: { id: ctx.user.id },
        }),
      );
      if (!getUserResponse.ok) {
        console.error(`[${ctx.req.path}]`, getUserResponse.error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while retrieving the current user',
        });
      }
      const user = getUserResponse.data;

      if (user == null) {
        throw new TRPCError({
          code: 'BAD_GATEWAY',
          message: 'The current user could does not exist',
        });
      }
      return { user };
    }),
    deleteAccount: authProcedure.mutation(async ({ ctx }) => {
      // Delete user (cascade will delete sessions, accounts, etc.)
      const deleteUserResponse = await tryAsync(() =>
        prisma.user.delete({
          where: { id: ctx.user.id },
        }),
      );
      if (!deleteUserResponse.ok) {
        console.error(`[${ctx.req.path}]`, deleteUserResponse.error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while deleting the user',
        });
      }
      return { success: true };
    }),
  });
}
