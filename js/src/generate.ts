import {
  AnchorIdl,
  rootNodeFromAnchorWithoutDefaultVisitor,
} from "@codama/nodes-from-anchor";
import { renderJavaScriptVisitor } from "@codama/renderers";
import { visit } from "@codama/visitors-core";
import anchorIdl from "./idl/opportunity_market.json";

async function generateClient() {
  const node = rootNodeFromAnchorWithoutDefaultVisitor(anchorIdl as AnchorIdl);

  try {
    await visit(node, await renderJavaScriptVisitor("src/generated"));
    console.log("✅ Generated Solana Kit client in src/generated/");
  } catch (e) {
    console.error("Error generating client:", e);
    throw e;
  }
}

generateClient();
