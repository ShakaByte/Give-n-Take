import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
    ...nextVitals,
    {
        rules: {
            // Plain apostrophes in text are fine, so we don't escape them.
            "react/no-unescaped-entities": "off",
            // Our pages load data inside effects on purpose (polling every 10 seconds).
            "react-hooks/set-state-in-effect": "off",
        },
    },
    // Override default ignores of eslint-config-next.
    globalIgnores([
        // Default ignores of eslint-config-next:
        ".next/**",
        "out/**",
        "build/**",
        "next-env.d.ts",
    ]),
]);

export default eslintConfig;
