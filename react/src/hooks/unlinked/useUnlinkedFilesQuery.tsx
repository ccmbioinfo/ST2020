import { useQuery } from "react-query";
import { UnlinkedFile } from "../../typings";
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
    const result = useQuery<UnlinkedFile[], Response>("unlinked", fetchFiles);
    return result;
}
