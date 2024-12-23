import { CodegenConfig } from "@graphql-codegen/cli";

const HASURA_URL = "https://immune-bunny-99.hasura.app/v1/graphql";

const config: CodegenConfig = {
  schema: HASURA_URL,
  documents: ["src/depositFetching/hasura/gql/queries.ts"],
  ignoreNoDocuments: true, // for better experience with the watcher
  generates: {
    "./src/depositFetching/hasura/gql/autogenerated/": {
      preset: "client",
    },
  },
};

export default config;
