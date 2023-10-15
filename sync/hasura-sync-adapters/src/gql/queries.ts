import { graphql } from "./autogenerated";

export const SdkEventsPaginatedById = graphql(`
  query fetchSdkEvents($from: String!, $toBlock: Int!, $limit: Int!) {
    sdk_event(
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
    subtree_commit(
      where: { block: { _lt: $toBlock } }
      limit: 1
      order_by: { id: desc }
    ) {
      subtree_batch_offset
    }
  }
`);