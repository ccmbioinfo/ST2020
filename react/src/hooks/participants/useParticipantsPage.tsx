import { Query, QueryResult } from "material-table";
import { useQueryClient } from "react-query";
import { queryTableData } from "../utils";
import { Participant } from "../../typings";

async function fetchParticipants(query: Query<Participant>) {
    const queryResult = await queryTableData<Participant>(query, "/api/participants");

    queryResult.data.forEach((participant: Participant) => {
        participant.dataset_types = participant.tissue_samples.flatMap(({ datasets }) =>
            datasets.map(dataset => dataset.dataset_type)
        );
        participant.affected += "";
        participant.solved += "";
    });

    return queryResult;
}

/**
 * Return a function for paging participant data.
 */
export function useParticipantsPage() {
    const queryClient = useQueryClient();

    return async (query: Query<Participant>) => {
        return await queryClient.fetchQuery<QueryResult<Participant>, Error>(
            ["participants", query],
            () => fetchParticipants(query)
        );
    };
}
