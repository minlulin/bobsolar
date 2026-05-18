type SeedAdminCredentials = {
  email: string | undefined;
  password: string | undefined;
};

function readTrimmedEnv(name: string): string | undefined {
  return process.env[name]?.trim();
}

export function getSeedAdminCredentials(): SeedAdminCredentials {
  const email = readTrimmedEnv("SEED_ADMIN_EMAIL") ?? readTrimmedEnv("ADMIN_EMAIL");
  const password = readTrimmedEnv("SEED_ADMIN_PASSWORD") ?? readTrimmedEnv("ADMIN_PASSWORD");

  return { email, password };
}
