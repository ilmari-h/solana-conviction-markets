import { getClusterAccAddress } from "@arcium-hq/client";

export const ARCIUM_CLUSTER_OFFSET = 456;

export function getClusterAddress() {
  return getClusterAccAddress(ARCIUM_CLUSTER_OFFSET)
}