import { auth } from "./auth";

async function createAdmin() {
  const adminPhone = "8056054719";
  try {
    await auth.api.signUpEmail({
      body: {
        email: `${adminPhone}@mohan-cabs.com`,
        password: "adminpassword",
        name: "Karthikeyan",
        role: "admin",
      },
    });
    console.log("✅ Admin created successfully!");
    console.log(`User: ${adminPhone}`);
    console.log(`Login Email: ${adminPhone}@mohan-cabs.com`);
  } catch (error) {
    console.error("❌ Failed to create admin:", error);
  }
}

createAdmin();
