import { buildApplication, buildRouteMap } from "@stricli/core";
import { command as build } from "./commands/build";

const root = buildRouteMap({
  routes: {
    build,
  },
  docs: {
    brief: "All available commands",
  },
});

export const app = buildApplication(root, {
  name: "datasworn-compiler",
  scanner: {
    caseStyle: "allow-kebab-for-camel",
  },
});
