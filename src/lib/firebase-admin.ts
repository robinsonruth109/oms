import {
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

import { getFirebaseServerConfig } from "@/lib/firebase-server-config";

const FIREBASE_APP_NAME = "gloss-and-glows-server";

function findFirebaseAdminApp() {
  return (
    getApps().find((app) => app.name === FIREBASE_APP_NAME) ?? null
  );
}

export function getFirebaseAdminApp(): App {
  const existingApp = findFirebaseAdminApp();

  if (existingApp) {
    return existingApp;
  }

  const config = getFirebaseServerConfig();

  return initializeApp(
    {
      credential: cert({
        projectId: config.projectId,
        clientEmail: config.clientEmail,
        privateKey: config.privateKey,
      }),
      projectId: config.projectId,
    },
    FIREBASE_APP_NAME
  );
}

export function getFirebaseMessagingClient(): Messaging {
  return getMessaging(getFirebaseAdminApp());
}

export async function verifyFirebaseAdminCredentials() {
  const app = getFirebaseAdminApp();
  const credential = app.options.credential;

  if (!credential) {
    throw new Error("Firebase Admin credential is not available.");
  }

  const accessToken = await credential.getAccessToken();

  if (!accessToken?.access_token) {
    throw new Error(
      "Firebase Admin could not obtain a Google OAuth access token."
    );
  }

  return {
    initialized: true,
    credentialsVerified: true,
    projectId: app.options.projectId ?? null,
  };
}
