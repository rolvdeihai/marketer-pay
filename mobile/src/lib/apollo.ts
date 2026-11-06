// mobile/src/lib/apollo.ts
import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { supabase } from "./supabase";

// Custom fetch: attach the CURRENT access token to every GraphQL request.
// getSession() returns a refreshed token if the old one expired.
const httpLink = new HttpLink({
  uri: `${process.env.EXPO_PUBLIC_API_URL}/graphql`,
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    const { data } = await supabase.auth.getSession();
    const headers = new Headers(init?.headers);
    const token = data.session?.access_token;
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  },
});

export const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache({
    typePolicies: {
      // Types without a single "id" field: don't try to normalize them.
      MarketerStat: { keyFields: false },
      DashboardStats: { keyFields: false },
      PayoutPreview: { keyFields: false },
      AssistantReply: { keyFields: false },
      PayRule: { keyFields: false },
    },
  }),
  defaultOptions: {
    // Show cached data instantly, then refresh from the network.
    watchQuery: { fetchPolicy: "cache-and-network" },
  },
});