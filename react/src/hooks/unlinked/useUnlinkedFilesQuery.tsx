import { useQuery } from "react-query";
import { basicFetch } from "../utils";

async function fetchFiles() {
    return await basicFetch("/api/unlinked");
}

/**
 * Return result of GET /api/unlinked.
 *
 * That is, return a sorted list of filenames
 * for all unlinked files in MinIO.
 */
export function useUnlinkedFilesQuery() {
    const result = useQuery<string[], Response>("unlinked", fetchFiles);
    return result;
}
