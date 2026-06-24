import { defineBuildConfig } from "obuild/config";

export default defineBuildConfig({
  entries: [
    {
      type: "bundle",
      input: [
        "src/index.ts",
        "src/transform.ts",
        "src/transform/acorn.ts",
        "src/transform/oxc.ts",
        "src/plugin.ts",
      ],
    },
  ],
});
