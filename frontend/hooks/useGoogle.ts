import { useEffect, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { useAuth } from "../context/AuthContext";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";

WebBrowser.maybeCompleteAuthSession();

// --- Firebase config (web config only) ---
const firebaseConfig = {
  apiKey: "AIzaSyAmtGIy1QZZeVvREJqPlbEQTIAynzAWgJE",
  authDomain: "zuba-c6e5c.firebaseapp.com",
  projectId: "zuba-c6e5c",
  storageBucket: "zuba-c6e5c.appspot.com",
  messagingSenderId: "1080883654544",
  appId: "1:1080883654544:web:xxxxxxxxxxxxx"  // ← replace with real web appId
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// --- Hook ---
export function useGoogleLogin() {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Required for dev builds
  const redirectUri = makeRedirectUri({
    native: "com.frontend:/oauthredirect",
    useProxy: false,
  });

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID!,
    androidClientId: process.env.EXPO_PUBLIC_FIREBASE_ANDROID_CLIENT_ID!,
    iosClientId: undefined,
    redirectUri,
  });

  useEffect(() => {
    if (response?.type === "success") {
      const idToken = response.authentication?.idToken;
      if (idToken) handleGoogleSignIn(idToken);
    }

    if (response?.type === "error") {
      setError("Google sign-in failed");
      setIsLoading(false);
    }
  }, [response]);

  const handleGoogleSignIn = async (idToken: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      const firebaseUser = userCredential.user;

      const [firstName, ...lastNameParts] = (firebaseUser.displayName || "").split(" ");
      const lastName = lastNameParts.join(" ");

      const res = await fetch(`${API_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          email: firebaseUser.email,
          firstName,
          lastName,
          photoURL: firebaseUser.photoURL,
          uid: firebaseUser.uid,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message);

      await login(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    signInWithGoogle: () => promptAsync().catch(() => setIsLoading(false)),
    isLoading,
    error,
    request,
  };
}
