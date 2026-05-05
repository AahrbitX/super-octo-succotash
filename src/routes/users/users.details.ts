import { db } from "@/db";
import { t } from "elysia";

import { eq } from "drizzle-orm";
import { user as usersTable } from "@/db/auth-schema";

export const userDetailsSchema = {
  params: t.Object({
    id: t.String(),
  }),
  response: {
    404: t.Object({
      success: t.Boolean(),
      message: t.String(),
    }),
  },
  detail: {
    tags: ["Users"],
    description: "",
  },
};

export const userDetails = async ({
  params,
  set,
}: {
  params: (typeof userDetailsSchema)["params"]["static"];
  set: any;
}) => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, params.id))
    .limit(1);

  if (!user) {
    set.status = 404;
    return { success: false, message: "Driver not found" };
  }

  return {
    success: true,
    data: user,
  };
};
