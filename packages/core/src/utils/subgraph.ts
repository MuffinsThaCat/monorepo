import retry from "async-retry";
import { TotalEntityIndex, TotalEntityIndexTrait } from "../sync";
import { maxArray } from "./functional";
import { batchOffsetToLatestMerkleIndexInBatch } from "./tree";
import { Logger } from "winston";

// see https://thegraph.com/docs/en/querying/graphql-api/#subgraph-metadata
const latestIndexedBlockQuery = `
{
  _meta {
    block {
      number
    }
  }
}
`;

interface fetchLatestIndexedBlockResponse {
  data: {
    _meta: {
      block: {
        number: number;
      };
    };
  };
}

// gets the latest indexed block from the subgraph
export async function fetchLatestIndexedBlock(
  endpoint: string,
  logger?: Logger
): Promise<number> {
  const query = makeSubgraphQuery<undefined, fetchLatestIndexedBlockResponse>(
    endpoint,
    latestIndexedBlockQuery,
    "latest indexed block",
    logger
  );
  const res = await query(undefined);

  if (!res.data) {
    const msg = `could not get latest indexed block from subgraph. Response: ${JSON.stringify(
      res,
      undefined,
      2
    )}`;
    throw Error(msg);
  }
  return res.data._meta.block.number;
}

export const makeSubgraphQuery =
  <T, U>(endpoint: string, query: string, dataLabel: string, logger?: Logger) =>
  async (variables: T): Promise<U> => {
    return await retry(
      async (bail) => {
        try {
          // if anything throws, we retry
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query,
              variables,
            }),
          });

          if (!response.ok) {
            const text = await response.text();
            const errMsg = `failed to query ${dataLabel} from subgraph: ${text}`;
            logger && logger.error(errMsg);

            const error = new Error(errMsg);
            if (response.status === 400) {
              bail(error);
            } else {
              throw error;
            }
          }

          return (await response.json()) as U;
        } catch (err) {
          logger && logger.error(`could not query ${dataLabel} from subgraph`);
          throw err;
        }
      },
      {
        retries: 5,
      }
    );
  };

interface FetchSubtreeCommitsResponse {
  data: {
    subtreeCommits: SubtreeCommitResponse[];
  };
}

interface FetchSubtreeCommitsVars {
  toIdx?: string;
}

interface SubtreeCommitResponse {
  subtreeBatchOffset: string;
}

const subtreeCommitQuery = (params: string, whereClause: string) => `
  query fetchSubtreeCommits${params} {
    subtreeCommits(${whereClause}orderBy: subtreeBatchOffset, orderDirection: desc, first: 1) {
      subtreeBatchOffset
    }
  }
`;

// gets last committed merkle index on or before a given totalEntityIndex
export async function fetchLatestCommittedMerkleIndex(
  endpoint: string,
  toTotalEntityIndex?: TotalEntityIndex,
  logger?: Logger
): Promise<number | undefined> {
  let params = "";
  let whereClause = "";
  if (toTotalEntityIndex) {
    params = "($toIdx: String!)";
    whereClause = "where: { id_lt: $toIdx }, ";
  }

  const rawQuery = subtreeCommitQuery(params, whereClause);

  const query = makeSubgraphQuery<
    FetchSubtreeCommitsVars,
    FetchSubtreeCommitsResponse
  >(endpoint, rawQuery, "last committed merkle index", logger);

  const toIdx = toTotalEntityIndex
    ? TotalEntityIndexTrait.toStringPadded(toTotalEntityIndex)
    : undefined;
  const res = await query({ toIdx });

  if (!res.data) {
    throw new Error(
      "received empty response from subgraph when fetching lastCommittedMerkleIndex"
    );
  }

  if (res.data.subtreeCommits.length === 0) {
    return undefined;
  }

  const subtreeBatchOffsets = res.data.subtreeCommits.map((commit) =>
    parseInt(commit.subtreeBatchOffset)
  );
  const maxSubtreeBatchOffset = maxArray(subtreeBatchOffsets);

  return batchOffsetToLatestMerkleIndexInBatch(maxSubtreeBatchOffset);
}
