import { t } from "elysia";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logging";

export const createUserSchema = {
  body: t.Object({
    name: t.String(),
    phone: t.String(),
    dob: t.Optional(t.String()),
  }),
  response: t.Object({
    success: t.Boolean(),
    message: t.String(),
    userId: t.Nullable(t.String()),
  }),
  detail: {
    tags: ["Users"],
    description: "Create a new user (admin only)",
  },
};

export const createUser = async ({
  body,
  set,
}: {
  body: (typeof createUserSchema)["body"]["static"];
  set: any;
}) => {
  const requestId = crypto.randomUUID();

  logger.info(
    {
      requestId,
      module: "users",
      action: "create",
      payload: { name: body.name, phone: body.phone },
    },
    "User creation started",
  );

  // Default password is the phone number (user can change it later)
  const email = `${body.phone}@mohan-cabs.com`;
  const password = body.phone;

  try {
    const newUser = await auth.api.signUpEmail({
      body: {
        name: body.name,
        email,
        password,
        role: "user",
        phoneNumber: body.phone,
        ...(body.dob ? { dob: new Date(body.dob).toISOString() } : {}),
      },
    });

    if (!newUser) {
      throw new Error("Failed to create user");
    }

    logger.info(
      { requestId, module: "users", userId: newUser.user.id },
      "User created successfully",
    );

    set.status = 201;
    return {
      success: true,
      message: "User created successfully",
      userId: newUser.user.id,
    };
  } catch (error: any) {
    logger.error(
      { requestId, module: "users", action: "create", error: error.message },
      "User creation failed",
    );

    set.status = 400;
    return {
      success: false,
      message: error.message?.includes("unique")
        ? "Phone number already exists"
        : "Failed to create user",
      userId: null,
    };
  }
};
