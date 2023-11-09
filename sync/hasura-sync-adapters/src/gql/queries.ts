import { graphql } from "./autogenerated";

export const GoerliSdkEventsPaginatedById = graphql(`
  query goerliFetchSdkEvents($from: String!, $toBlock: Int!, $limit: Int!) {
    goerli_sdk_events(
      where: { id: { _gte: $from }, block: { _lt: $toBlock } }
      order_by: { id: asc }
      limit: $limit
    ) {
      id
      merkle_index
      encoded_note_encoded_asset_addr
      encoded_note_encoded_asset_id
      encoded_note_nonce
      encoded_note_owner_h1
      encoded_note_owner_h2
      encoded_note_value
      encrypted_note_ciphertext_bytes
      encrypted_note_commitment
      encrypted_note_encapsulated_secret_bytes
      nullifier
    }
    goerli_subtree_commits(
      where: { block: { _lt: $toBlock } }
      limit: 1
      order_by: { id: desc }
    ) {
      subtree_batch_offset
    }
  }
`);

export const GoerliLatestIndexedMerkleIndexUpToBlock = graphql(`
  query goerliFetchLatestIndexedMerkleIndexUpToBlock($toBlock: Int!) {
    goerli_sdk_events_aggregate(where: { block: { _lte: $toBlock } }) {
      aggregate {
        max {
          merkle_index
        }
      }
    }
  }
`);

export const GoerliLatestIndexedMerkleIndex = graphql(`
  query goerliFetchLatestIndexedMerkleIndex {
    goerli_sdk_events_aggregate {
      aggregate {
        max {
          merkle_index
        }
      }
    }
  }
`);

export const MainnetSdkEventsPaginatedById = graphql(`
  query mainnetFetchSdkEvents($from: String!, $toBlock: Int!, $limit: Int!) {
    mainnet_sdk_events(
      where: { id: { _gte: $from }, block: { _lt: $toBlock } }
      order_by: { id: asc }
      limit: $limit
    ) {
      id
      merkle_index
      encoded_note_encoded_asset_addr
      encoded_note_encoded_asset_id
      encoded_note_nonce
      encoded_note_owner_h1
      encoded_note_owner_h2
      encoded_note_value
      encrypted_note_ciphertext_bytes
      encrypted_note_commitment
      encrypted_note_encapsulated_secret_bytes
      nullifier
    }
    mainnet_subtree_commits(
      where: { block: { _lt: $toBlock } }
      limit: 1
      order_by: { id: desc }
    ) {
      subtree_batch_offset
    }
  }
`);

export const MainnetLatestIndexedMerkleIndexUpToBlock = graphql(`
  query mainnetFetchLatestIndexedMerkleIndexUpToBlock($toBlock: Int!) {
    mainnet_sdk_events_aggregate(where: { block: { _lte: $toBlock } }) {
      aggregate {
        max {
          merkle_index
        }
      }
    }
  }
`);

export const MainnetLatestIndexedMerkleIndex = graphql(`
  query mainnetFetchLatestIndexedMerkleIndex {
    mainnet_sdk_events_aggregate {
      aggregate {
        max {
          merkle_index
        }
      }
    }
  }
`);
