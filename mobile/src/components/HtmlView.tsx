// mobile/src/components/HtmlView.tsx
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { colors } from "./ui";

/** Renders AI-generated HTML in an isolated WebView. */
export function HtmlView({ html, height = 360 }: { html: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff" }}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        javaScriptEnabled
        setSupportMultipleWindows={false}
        // Block navigation away from the generated page (links, redirects).
        onShouldStartLoadWithRequest={(req) => req.url === "about:blank" || req.url.startsWith("data:")}
      />
    </View>
  );
}