import { Redirect } from "expo-router";
import React from "react";
import { useAuthState } from "lib/stores/auth";

export default function MustBeSignedIn({ children }: React.PropsWithChildren<unknown>) {
  const notSignedIn = useAuthState((state) => state.kind === "NotSignedIn");

  if (notSignedIn) {
    return <Redirect href="/auth/login" />;
  }

  return children;
}