// mobile/src/components/HtmlView.web.tsx
import { View } from "react-native";
import { colors } from "./ui";

/** Web version: a sandboxed iframe. "allow-scripts" WITHOUT "allow-same-origin"
 *  means the chart's JS runs, but it can't read our cookies, storage or DOM. */
export function HtmlView({ html, height = 360 }: { html: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff" }}>
      <iframe title="AI chart" srcDoc={html} sandbox="allow-scripts" style={{ border: 0, width: "100%", height: "100%" }} />
    </View>
  );
}