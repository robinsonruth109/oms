export type FirebaseServerConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

export type FirebaseConfigurationStatus = {
  configured: boolean;
  projectIdConfigured: boolean;
  clientEmailConfigured: boolean;
  privateKeyConfigured: boolean;
  privateKeyLooksValid: boolean;
  projectId: string | null;
  clientEmail: string | null;
};

function readEnv(name: string) {
  return String(process.env[name] ?? "").trim();
}

function normalisePrivateKey(value: string) {
  if (!value) {
    return "";
  }

  const normalised = value.replace(/\\n/g, "\n").replace(/\r/g, "").trim();

  return normalised ? `${normalised}\n` : "";
}

function privateKeyLooksValid(privateKey: string) {
  return (
    privateKey.includes("-----BEGIN PRIVATE KEY-----") &&
    privateKey.includes("-----END PRIVATE KEY-----") &&
    privateKey.length > 500
  );
}

export function getFirebaseConfigurationStatus(): FirebaseConfigurationStatus {
  const projectId = readEnv("FIREBASE_PROJECT_ID");
  const clientEmail = readEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = normalisePrivateKey(readEnv("FIREBASE_PRIVATE_KEY"));

  const projectIdConfigured = Boolean(projectId);
  const clientEmailConfigured = Boolean(clientEmail);
  const privateKeyConfigured = Boolean(privateKey);
  const privateKeyIsValid = privateKeyLooksValid(privateKey);

  return {
    configured:
      projectIdConfigured &&
      clientEmailConfigured &&
      privateKeyConfigured &&
      privateKeyIsValid,
    projectIdConfigured,
    clientEmailConfigured,
    privateKeyConfigured,
    privateKeyLooksValid: privateKeyIsValid,
    projectId: projectId || null,
    clientEmail: clientEmail || null,
  };
}

export function getFirebaseServerConfig(): FirebaseServerConfig {
  const status = getFirebaseConfigurationStatus();

  if (!status.configured || !status.projectId || !status.clientEmail) {
    throw new Error(
      "Firebase server credentials are missing or invalid. Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
    );
  }

  const privateKey = normalisePrivateKey(readEnv("FIREBASE_PRIVATE_KEY"));

  return {
    projectId: status.projectId,
    clientEmail: status.clientEmail,
    privateKey,
  };
}
