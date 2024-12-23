/* eslint-disable */
import * as types from "./graphql";
import { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core";

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 */
const documents = {
  "\n  query goerliFetchSdkEvents($from: String!, $toBlock: Int!, $limit: Int!) {\n    goerli_sdk_events(\n      where: { id: { _gte: $from }, block: { _lt: $toBlock } }\n      order_by: { id: asc }\n      limit: $limit\n    ) {\n      id\n      merkle_index\n      encoded_note_encoded_asset_addr\n      encoded_note_encoded_asset_id\n      encoded_note_nonce\n      encoded_note_owner_h1\n      encoded_note_owner_h2\n      encoded_note_value\n      encrypted_note_ciphertext_bytes\n      encrypted_note_commitment\n      encrypted_note_encapsulated_secret_bytes\n      nullifier\n    }\n    goerli_subtree_commits(\n      where: { block: { _lt: $toBlock } }\n      limit: 1\n      order_by: { id: desc }\n    ) {\n      id\n      subtree_batch_offset\n    }\n  }\n":
    types.GoerliFetchSdkEventsDocument,
  "\n  query goerliFetchLatestIndexedMerkleIndexUpToBlock($toBlock: Int!) {\n    goerli_sdk_events_aggregate(where: { block: { _lte: $toBlock } }) {\n      aggregate {\n        max {\n          merkle_index\n        }\n      }\n    }\n  }\n":
    types.GoerliFetchLatestIndexedMerkleIndexUpToBlockDocument,
  "\n  query goerliFetchLatestIndexedMerkleIndex {\n    goerli_sdk_events_aggregate {\n      aggregate {\n        max {\n          merkle_index\n        }\n      }\n    }\n  }\n":
    types.GoerliFetchLatestIndexedMerkleIndexDocument,
  "\n  query mainnetFetchSdkEvents($from: String!, $toBlock: Int!, $limit: Int!) {\n    mainnet_sdk_events(\n      where: { id: { _gte: $from }, block: { _lt: $toBlock } }\n      order_by: { id: asc }\n      limit: $limit\n    ) {\n      id\n      merkle_index\n      encoded_note_encoded_asset_addr\n      encoded_note_encoded_asset_id\n      encoded_note_nonce\n      encoded_note_owner_h1\n      encoded_note_owner_h2\n      encoded_note_value\n      encrypted_note_ciphertext_bytes\n      encrypted_note_commitment\n      encrypted_note_encapsulated_secret_bytes\n      nullifier\n    }\n    mainnet_subtree_commits(\n      where: { block: { _lt: $toBlock } }\n      limit: 1\n      order_by: { id: desc }\n    ) {\n      id\n      subtree_batch_offset\n    }\n  }\n":
    types.MainnetFetchSdkEventsDocument,
  "\n  query mainnetFetchLatestIndexedMerkleIndexUpToBlock($toBlock: Int!) {\n    mainnet_sdk_events_aggregate(where: { block: { _lte: $toBlock } }) {\n      aggregate {\n        max {\n          merkle_index\n        }\n      }\n    }\n  }\n":
    types.MainnetFetchLatestIndexedMerkleIndexUpToBlockDocument,
  "\n  query mainnetFetchLatestIndexedMerkleIndex {\n    mainnet_sdk_events_aggregate {\n      aggregate {\n        max {\n          merkle_index\n        }\n      }\n    }\n  }\n":
    types.MainnetFetchLatestIndexedMerkleIndexDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query goerliFetchSdkEvents($from: String!, $toBlock: Int!, $limit: Int!) {\n    goerli_sdk_events(\n      where: { id: { _gte: $from }, block: { _lt: $toBlock } }\n      order_by: { id: asc }\n      limit: $limit\n    ) {\n      id\n      merkle_index\n      encoded_note_encoded_asset_addr\n      encoded_note_encoded_asset_id\n      encoded_note_nonce\n      encoded_note_owner_h1\n      encoded_note_owner_h2\n      encoded_note_value\n      encrypted_note_ciphertext_bytes\n      encrypted_note_commitment\n      encrypted_note_encapsulated_secret_bytes\n      nullifier\n    }\n    goerli_subtree_commits(\n      where: { block: { _lt: $toBlock } }\n      limit: 1\n      order_by: { id: desc }\n    ) {\n      id\n      subtree_batch_offset\n    }\n  }\n"
): (typeof documents)["\n  query goerliFetchSdkEvents($from: String!, $toBlock: Int!, $limit: Int!) {\n    goerli_sdk_events(\n      where: { id: { _gte: $from }, block: { _lt: $toBlock } }\n      order_by: { id: asc }\n      limit: $limit\n    ) {\n      id\n      merkle_index\n      encoded_note_encoded_asset_addr\n      encoded_note_encoded_asset_id\n      encoded_note_nonce\n      encoded_note_owner_h1\n      encoded_note_owner_h2\n      encoded_note_value\n      encrypted_note_ciphertext_bytes\n      encrypted_note_commitment\n      encrypted_note_encapsulated_secret_bytes\n      nullifier\n    }\n    goerli_subtree_commits(\n      where: { block: { _lt: $toBlock } }\n      limit: 1\n      order_by: { id: desc }\n    ) {\n      id\n      subtree_batch_offset\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query goerliFetchLatestIndexedMerkleIndexUpToBlock($toBlock: Int!) {\n    goerli_sdk_events_aggregate(where: { block: { _lte: $toBlock } }) {\n      aggregate {\n        max {\n          merkle_index\n        }\n      }\n    }\n  }\n"
): (typeof documents)["\n  query goerliFetchLatestIndexedMerkleIndexUpToBlock($toBlock: Int!) {\n    goerli_sdk_events_aggregate(where: { block: { _lte: $toBlock } }) {\n      aggregate {\n        max {\n          merkle_index\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query goerliFetchLatestIndexedMerkleIndex {\n    goerli_sdk_events_aggregate {\n      aggregate {\n        max {\n          merkle_index\n        }\n      }\n    }\n  }\n"
): (typeof documents)["\n  query goerliFetchLatestIndexedMerkleIndex {\n    goerli_sdk_events_aggregate {\n      aggregate {\n        max {\n          merkle_index\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query mainnetFetchSdkEvents($from: String!, $toBlock: Int!, $limit: Int!) {\n    mainnet_sdk_events(\n      where: { id: { _gte: $from }, block: { _lt: $toBlock } }\n      order_by: { id: asc }\n      limit: $limit\n    ) {\n      id\n      merkle_index\n      encoded_note_encoded_asset_addr\n      encoded_note_encoded_asset_id\n      encoded_note_nonce\n      encoded_note_owner_h1\n      encoded_note_owner_h2\n      encoded_note_value\n      encrypted_note_ciphertext_bytes\n      encrypted_note_commitment\n      encrypted_note_encapsulated_secret_bytes\n      nullifier\n    }\n    mainnet_subtree_commits(\n      where: { block: { _lt: $toBlock } }\n      limit: 1\n      order_by: { id: desc }\n    ) {\n      id\n      subtree_batch_offset\n    }\n  }\n"
): (typeof documents)["\n  query mainnetFetchSdkEvents($from: String!, $toBlock: Int!, $limit: Int!) {\n    mainnet_sdk_events(\n      where: { id: { _gte: $from }, block: { _lt: $toBlock } }\n      order_by: { id: asc }\n      limit: $limit\n    ) {\n      id\n      merkle_index\n      encoded_note_encoded_asset_addr\n      encoded_note_encoded_asset_id\n      encoded_note_nonce\n      encoded_note_owner_h1\n      encoded_note_owner_h2\n      encoded_note_value\n      encrypted_note_ciphertext_bytes\n      encrypted_note_commitment\n      encrypted_note_encapsulated_secret_bytes\n      nullifier\n    }\n    mainnet_subtree_commits(\n      where: { block: { _lt: $toBlock } }\n      limit: 1\n      order_by: { id: desc }\n    ) {\n      id\n      subtree_batch_offset\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query mainnetFetchLatestIndexedMerkleIndexUpToBlock($toBlock: Int!) {\n    mainnet_sdk_events_aggregate(where: { block: { _lte: $toBlock } }) {\n      aggregate {\n        max {\n          merkle_index\n        }\n      }\n    }\n  }\n"
): (typeof documents)["\n  query mainnetFetchLatestIndexedMerkleIndexUpToBlock($toBlock: Int!) {\n    mainnet_sdk_events_aggregate(where: { block: { _lte: $toBlock } }) {\n      aggregate {\n        max {\n          merkle_index\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query mainnetFetchLatestIndexedMerkleIndex {\n    mainnet_sdk_events_aggregate {\n      aggregate {\n        max {\n          merkle_index\n        }\n      }\n    }\n  }\n"
): (typeof documents)["\n  query mainnetFetchLatestIndexedMerkleIndex {\n    mainnet_sdk_events_aggregate {\n      aggregate {\n        max {\n          merkle_index\n        }\n      }\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> =
  TDocumentNode extends DocumentNode<infer TType, any> ? TType : never;
